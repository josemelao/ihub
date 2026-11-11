import { json } from '@sveltejs/kit';
import { removeSourceFromCache, sourceCacheIsStale } from '#lib/feed/cache';
import { applyHubAction, type HubPayload } from '#lib/hub-actions';
import { readJsonLimited, RequestBodyError, isRecord, isInternalError } from '#lib/net/body';
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
	const payload = parsed as unknown as HubPayload;

	const storage = getStorage();

	try {
		let previousSource: HubData['feedSources'][number] | undefined;
		let nextSource: HubData['feedSources'][number] | undefined;
		const sourceId = payload.id;
		const touchesSourceCache =
			payload.action === 'delete-source' || payload.action === 'update-source';

		const mutateHub = (hub: HubData): HubData => {
			previousSource = sourceId
				? hub.feedSources.find((source) => source.id === sourceId)
				: undefined;
			const next = parseHub(applyHubAction(hub, payload));
			nextSource = sourceId ? next.feedSources.find((source) => source.id === sourceId) : undefined;
			return next;
		};

		const result: { hub: HubData } =
			sourceId && touchesSourceCache
				? await storage.updateHubAndCache(mutateHub, (cache) => {
						const stale = sourceCacheIsStale(previousSource, nextSource);
						const removed = payload.action === 'delete-source';
						return stale || removed ? removeSourceFromCache(cache, sourceId) : cache;
					})
				: { hub: await storage.updateHub(mutateHub) };
		const validated = result.hub;

		return json({ ok: true, hub: validated });
	} catch (error) {
		if (error instanceof HubValidationError) {
			return json({ ok: false, error: error.message, issues: error.issues }, { status: 400 });
		}
		if (!isInternalError(error) && error instanceof Error) {
			const code = (error as { code?: unknown }).code;
			if (typeof code === 'string') {
				return json({ ok: false, error: 'Falha ao gravar o hub.' }, { status: 500 });
			}
			return json({ ok: false, error: error.message }, { status: 400 });
		}
		return json({ ok: false, error: 'Falha inesperada ao atualizar o hub.' }, { status: 500 });
	}
};
