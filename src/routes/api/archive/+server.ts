import { json } from '@sveltejs/kit';
import { deleteArchive, enqueueArchive, reconcileArchiveIndex } from '#lib/archive/service';
import { isInternalError, isRecord, readJsonLimited, RequestBodyError } from '#lib/net/body';
import { getStorage } from '#lib/storage';
import type { RequestHandler } from './$types';

const MAX_BODY_BYTES = 4_096;
const ITEM_ID = /^[A-Za-z0-9_-]{1,64}$/;

export const GET: RequestHandler = async () => {
	try {
		const index = await reconcileArchiveIndex(getStorage());
		const entries = Object.values(index.entries);

		return json({
			ok: true,
			entries,
			totals: {
				count: entries.length,
				bytes: entries.reduce((total, entry) => total + entry.bytes, 0)
			}
		});
	} catch (error) {
		if (!isInternalError(error) && error instanceof Error) {
			return json({ ok: false, error: error.message }, { status: 500 });
		}
		return json({ ok: false, error: 'Falha ao carregar os arquivos.' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	let parsed: unknown;
	try {
		parsed = await readJsonLimited(request, MAX_BODY_BYTES);
	} catch (error) {
		if (error instanceof RequestBodyError) {
			return json({ ok: false, error: error.message }, { status: error.status });
		}
		return json({ ok: false, error: 'Corpo JSON inválido.' }, { status: 400 });
	}

	if (
		!isRecord(parsed) ||
		typeof parsed.action !== 'string' ||
		!parsed.action ||
		typeof parsed.itemId !== 'string' ||
		!ITEM_ID.test(parsed.itemId)
	) {
		return json({ ok: false, error: 'Payload inválido.' }, { status: 400 });
	}

	const storage = getStorage();
	const itemId = parsed.itemId;

	try {
		if (parsed.action === 'delete') {
			const removed = await deleteArchive(storage, itemId);
			return json({ ok: true, removed });
		}

		if (parsed.action === 'archive' || parsed.action === 'retry') {
			const state = await storage.loadState();
			if (!state.saved.includes(itemId)) {
				return json(
					{ ok: false, error: 'Post não está salvo; salve antes de arquivar.' },
					{ status: 409 }
				);
			}
			const snapshot = state.savedItems?.[itemId];
			if (!snapshot) {
				return json({ ok: false, error: 'Post não encontrado.' }, { status: 404 });
			}

			const hub = await storage.loadHub().catch(() => null);
			const source = hub?.feedSources.find((entry) => entry.id === snapshot.sourceId);
			const entry = await enqueueArchive(storage, {
				item: snapshot.item,
				title: snapshot.item.title,
				sourceType: source?.type ?? 'rss'
			});

			return json({ ok: true, entry }, { status: 202 });
		}

		return json({ ok: false, error: 'Ação inválida.' }, { status: 400 });
	} catch (error) {
		if (!isInternalError(error) && error instanceof Error) {
			return json({ ok: false, error: error.message }, { status: 500 });
		}
		return json({ ok: false, error: 'Falha ao atualizar o arquivo.' }, { status: 500 });
	}
};
