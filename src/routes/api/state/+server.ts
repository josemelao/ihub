import { json } from '@sveltejs/kit';
import { deleteArchive, enqueueArchive } from '#lib/archive/service';
import { EMPTY_STATE } from '#lib/defaults';
import { readJsonLimited, RequestBodyError, isRecord, isInternalError } from '#lib/net/body';
import { HubValidationError } from '#lib/schema';
import { applyStateAction, type StatePayload } from '#lib/state-actions';
import { getStorage } from '#lib/storage';
import { isRecoverableDataError, StorageError } from '#lib/storage/errors';
import type { HubState } from '#lib/types';
import type { RequestHandler } from './$types';

const MAX_BODY_BYTES = 2_000_000;

class StateActionError extends Error {}

/** Efeitos colaterais do arquivamento: nunca derrubam a resposta de estado. */
async function triggerArchive(
	storage: ReturnType<typeof getStorage>,
	payload: StatePayload,
	state: HubState
): Promise<void> {
	if (payload.action === 'unsave' && payload.id) {
		await deleteArchive(storage, payload.id);
		return;
	}

	if (payload.action === 'unsave-many' && Array.isArray(payload.ids)) {
		for (const id of payload.ids) {
			if (typeof id === 'string') await deleteArchive(storage, id);
		}
		return;
	}

	if (payload.action !== 'save' && payload.action !== 'save-many') return;

	const hub = await storage.loadHub().catch(() => null);
	const ids =
		payload.action === 'save' && payload.id
			? [payload.id]
			: (payload.entries ?? []).map((entry) => entry.id);

	for (const id of ids) {
		const snapshot = state.savedItems?.[id];
		if (!snapshot) continue;
		const source = hub?.feedSources.find((entry) => entry.id === snapshot.sourceId);
		if (source && source.type !== 'rss') continue;
		await enqueueArchive(storage, {
			item: snapshot.item,
			title: snapshot.item.title,
			sourceType: source?.type ?? 'rss'
		});
	}
}

export const GET: RequestHandler = async () => {
	const storage = getStorage();
	try {
		return json(await storage.loadState());
	} catch (error) {
		if (!(error instanceof HubValidationError) && !isRecoverableDataError(error)) throw error;
		return json((await storage.loadStateFromBackup()) ?? structuredClone(EMPTY_STATE));
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

	if (!isRecord(parsed) || typeof parsed.action !== 'string' || !parsed.action) {
		return json({ ok: false, error: 'Payload inválido: informe "action".' }, { status: 400 });
	}
	const payload = parsed as unknown as StatePayload;

	const now = new Date().toISOString();

	try {
		const state = await getStorage().updateStateWithFallback((current) => {
			const result = applyStateAction(current, payload, now);
			if (!result.ok) throw new StateActionError(result.error);
			return result.state;
		});

		void triggerArchive(getStorage(), payload, state).catch(() => undefined);
		return json({ ok: true, state });
	} catch (error) {
		if (error instanceof StateActionError) {
			return json({ ok: false, error: error.message }, { status: 400 });
		}
		if (error instanceof HubValidationError) {
			return json({ ok: false, error: error.message, issues: error.issues }, { status: 400 });
		}
		if (error instanceof StorageError) {
			return json({ ok: false, error: error.message }, { status: 500 });
		}
		if (!isInternalError(error)) throw error;
		return json({ ok: false, error: 'Falha inesperada ao atualizar o estado.' }, { status: 500 });
	}
};
