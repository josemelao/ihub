import { json } from '@sveltejs/kit';
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
