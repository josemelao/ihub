import { json } from '@sveltejs/kit';
import { isInternalError, isRecord, readJsonLimited, RequestBodyError } from '#lib/net/body';
import { ReaderError } from '#lib/reader/extract';
import { getOrExtractArticle } from '#lib/reader/service';
import { HubValidationError } from '#lib/schema';
import { getStorage } from '#lib/storage';
import type { RequestHandler } from './$types';

const MAX_BODY_BYTES = 4_096;
const ITEM_ID = /^[A-Za-z0-9_-]{1,64}$/;

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

	if (!isRecord(parsed) || typeof parsed.itemId !== 'string' || !ITEM_ID.test(parsed.itemId)) {
		return json({ ok: false, error: 'Informe um itemId válido.' }, { status: 400 });
	}
	const itemId = parsed.itemId;
	const storage = getStorage();

	try {
		const feed = await storage.loadFeedCache();
		const item = feed.items.find((entry) => entry.id === itemId);
		if (!item) {
			return json({ ok: false, error: 'Post não encontrado no cache.' }, { status: 404 });
		}

		const cached = await storage.loadArticle(itemId);
		if (cached) return json({ ok: true, article: cached });

		const hub = await storage.loadHub();
		const source = hub.feedSources.find((entry) => entry.id === item.sourceId);
		if (!source || source.type !== 'rss') {
			return json(
				{
					ok: false,
					error: 'Reader indisponível para esta fonte.',
					code: 'reader-unavailable'
				},
				{ status: 409 }
			);
		}
		if (!source.fullText) {
			return json(
				{
					ok: false,
					error: 'Texto completo desativado para esta fonte.',
					code: 'full-text-off'
				},
				{ status: 409 }
			);
		}

		const article = await getOrExtractArticle(storage, item);
		return json({ ok: true, article });
	} catch (error) {
		if (error instanceof ReaderError) {
			return json({ ok: false, error: error.message, code: error.code }, { status: 502 });
		}
		if (error instanceof HubValidationError) {
			return json({ ok: false, error: 'Dados de leitura inválidos.' }, { status: 500 });
		}
		if (!isInternalError(error) && error instanceof Error) {
			return json({ ok: false, error: 'Falha ao extrair o texto completo.' }, { status: 502 });
		}
		return json({ ok: false, error: 'Falha inesperada ao extrair o texto.' }, { status: 500 });
	}
};
