import { json } from '@sveltejs/kit';
import { getStorage } from '#lib/storage';
import type { HubState } from '#lib/types';
import type { RequestHandler } from './$types';

type StateAction = 'read' | 'unread' | 'save' | 'unsave' | 'mark-all-read';

interface StatePayload {
	action?: StateAction;
	id?: string;
	ids?: string[];
}

export const GET: RequestHandler = async () => {
	return json(await getStorage().loadState());
};

export const POST: RequestHandler = async ({ request }) => {
	let payload: StatePayload;
	try {
		payload = (await request.json()) as StatePayload;
	} catch {
		return json({ ok: false, error: 'Corpo JSON inválido.' }, { status: 400 });
	}

	const action = payload.action;
	const now = new Date().toISOString();
	const storage = getStorage();
	const state: HubState = await storage.loadState();

	switch (action) {
		case 'read':
			if (!payload.id) return invalid('Informe o id do post.');
			state.read[payload.id] = now;
			break;

		case 'unread':
			if (!payload.id) return invalid('Informe o id do post.');
			delete state.read[payload.id];
			break;

		case 'save':
			if (!payload.id) return invalid('Informe o id do post.');
			state.saved = [...new Set([...state.saved, payload.id])];
			break;

		case 'unsave':
			if (!payload.id) return invalid('Informe o id do post.');
			state.saved = state.saved.filter((id) => id !== payload.id);
			break;

		case 'mark-all-read':
			if (!Array.isArray(payload.ids)) return invalid('Envie a lista de ids.');
			for (const id of payload.ids) {
				if (typeof id === 'string') state.read[id] = now;
			}
			break;

		default:
			return invalid('Ação inválida.');
	}

	await storage.saveState(state);
	return json({ ok: true, state });
};

function invalid(message: string): Response {
	return json({ ok: false, error: message }, { status: 400 });
}
