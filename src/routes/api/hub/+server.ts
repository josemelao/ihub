import { json } from '@sveltejs/kit';
import { removeSourceFromCache, sourceCacheIsStale } from '#lib/feed/cache';
import { applyHubAction, type HubPayload } from '#lib/hub-actions';
import { HubValidationError, parseHub } from '#lib/schema';
import { getStorage } from '#lib/storage';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		return json(await getStorage().loadHub());
	} catch (error) {
		if (error instanceof HubValidationError) {
			return json({ error: error.message, issues: error.issues }, { status: 500 });
		}
		throw error;
	}
};

export const POST: RequestHandler = async ({ request }) => {
	let payload: HubPayload;
	try {
		payload = (await request.json()) as HubPayload;
	} catch {
		return json({ ok: false, error: 'Corpo JSON inválido.' }, { status: 400 });
	}

	const storage = getStorage();

	try {
		const hub = await storage.loadHub();
		const validated = parseHub(applyHubAction(hub, payload));
		await storage.saveHub(validated);

		const previousSource = payload.id
			? hub.feedSources.find((source) => source.id === payload.id)
			: undefined;
		const nextSource = payload.id
			? validated.feedSources.find((source) => source.id === payload.id)
			: undefined;
		const stale = sourceCacheIsStale(previousSource, nextSource);
		const removed = payload.action === 'delete-source' && Boolean(payload.id);

		if (payload.id && (stale || removed)) {
			try {
				const cache = await storage.loadFeedCache();
				await storage.saveFeedCache(removeSourceFromCache(cache, payload.id));
			} catch {
				// A edição do hub já foi salva; o cache será repopulado no próximo refresh.
			}
		}

		return json({ ok: true, hub: validated });
	} catch (error) {
		if (error instanceof HubValidationError) {
			return json({ ok: false, error: error.message, issues: error.issues }, { status: 400 });
		}
		if (error instanceof Error) {
			return json({ ok: false, error: error.message }, { status: 400 });
		}
		throw error;
	}
};
