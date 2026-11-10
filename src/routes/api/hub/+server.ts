import { json } from '@sveltejs/kit';
import { removeSourceFromCache, sourceCacheIsStale } from '#lib/feed/cache';
import { applyHubAction, type HubPayload } from '#lib/hub-actions';
import { readJsonLimited, RequestBodyError } from '#lib/net/body';
import { HubValidationError, parseHub } from '#lib/schema';
import { getStorage } from '#lib/storage';
import type { HubData } from '#lib/types';
import type { RequestHandler } from './$types';

const MAX_BODY_BYTES = 2_000_000;

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
		payload = (await readJsonLimited(request, MAX_BODY_BYTES)) as HubPayload;
	} catch (error) {
		if (error instanceof RequestBodyError) {
			return json({ ok: false, error: error.message }, { status: error.status });
		}
		return json({ ok: false, error: 'Corpo JSON inválido.' }, { status: 400 });
	}

	const storage = getStorage();

	try {
		let previousSource: HubData['feedSources'][number] | undefined;
		let nextSource: HubData['feedSources'][number] | undefined;
		const sourceId = payload.id;
		const touchesSourceCache =
			payload.action === 'delete-source' || payload.action === 'update-source';

		const { hub: validated } = await storage.updateHubAndCache(
			(hub) => {
				previousSource = sourceId
					? hub.feedSources.find((source) => source.id === sourceId)
					: undefined;
				const next = parseHub(applyHubAction(hub, payload));
				nextSource = sourceId
					? next.feedSources.find((source) => source.id === sourceId)
					: undefined;
				return next;
			},
			sourceId && touchesSourceCache
				? (cache) => {
						const stale = sourceCacheIsStale(previousSource, nextSource);
						const removed = payload.action === 'delete-source';
						return stale || removed ? removeSourceFromCache(cache, sourceId) : cache;
					}
				: null
		);

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
