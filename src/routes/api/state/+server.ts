import { json } from '@sveltejs/kit';
import { EMPTY_STATE } from '#lib/defaults';
import { readJsonLimited, RequestBodyError } from '#lib/net/body';
import { HubValidationError } from '#lib/schema';
import { applyStateAction, type StatePayload } from '#lib/state-actions';
import { getStorage } from '#lib/storage';
import type { RequestHandler } from './$types';

const MAX_BODY_BYTES = 2_000_000;

class StateActionError extends Error {}

export const GET: RequestHandler = async () => {
	const storage = getStorage();
	try {
		return json(await storage.loadState());
	} catch (error) {
		if (!(error instanceof HubValidationError)) throw error;
		return json((await storage.loadStateFromBackup()) ?? structuredClone(EMPTY_STATE));
	}
};

export const POST: RequestHandler = async ({ request }) => {
	let payload: StatePayload;
	try {
		payload = (await readJsonLimited(request, MAX_BODY_BYTES)) as StatePayload;
	} catch (error) {
		if (error instanceof RequestBodyError) {
			return json({ ok: false, error: error.message }, { status: error.status });
		}
		return json({ ok: false, error: 'Corpo JSON inválido.' }, { status: 400 });
	}

	const now = new Date().toISOString();

	try {
		const state = await getStorage().updateStateWithFallback((current) => {
			const result = applyStateAction(current, payload, now);
			if (!result.ok) throw new StateActionError(result.error);
			return result.state;
		});

		return json({ ok: true, state });
	} catch (error) {
		if (error instanceof StateActionError) {
			return json({ ok: false, error: error.message }, { status: 400 });
		}
		if (error instanceof HubValidationError) {
			return json({ ok: false, error: error.message, issues: error.issues }, { status: 400 });
		}
		throw error;
	}
};
