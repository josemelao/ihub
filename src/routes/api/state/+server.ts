import { json } from '@sveltejs/kit';
import { readJsonLimited, RequestBodyError } from '#lib/net/body';
import { toSafeHttpUrl } from '#lib/net/url';
import { getStorage } from '#lib/storage';
import type { HubState, SavedItemSnapshot } from '#lib/types';
import type { RequestHandler } from './$types';

const MAX_BODY_BYTES = 2_000_000;

type StateAction = 'read' | 'unread' | 'save' | 'unsave' | 'mark-all-read' | 'mark-unread';

interface StatePayload {
	action?: StateAction;
	id?: string;
	ids?: string[];
	snapshot?: SavedItemSnapshot;
}

export const GET: RequestHandler = async () => {
	return json(await getStorage().loadState());
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
			if (payload.snapshot) {
				const snapshot = safeSnapshot(payload.snapshot, payload.id);
				if (!snapshot) {
					return invalid('Snapshot inválido: item, URL ou thumbnail não são seguros.');
				}
				state.savedItems[payload.id] = { ...snapshot, savedAt: now };
			}
			break;

		case 'unsave':
			if (!payload.id) return invalid('Informe o id do post.');
			state.saved = state.saved.filter((id) => id !== payload.id);
			delete state.savedItems[payload.id];
			break;

		case 'mark-all-read':
			if (!Array.isArray(payload.ids)) return invalid('Envie a lista de ids.');
			for (const id of payload.ids) {
				if (typeof id === 'string') state.read[id] = now;
			}
			break;

		case 'mark-unread':
			if (!Array.isArray(payload.ids)) return invalid('Envie a lista de ids.');
			for (const id of payload.ids) {
				if (typeof id === 'string') delete state.read[id];
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

function safeSnapshot(snapshot: SavedItemSnapshot, id: string): SavedItemSnapshot | null {
	if (!snapshot || typeof snapshot !== 'object' || !snapshot.item) return null;
	if (snapshot.item.id !== id || typeof snapshot.item.title !== 'string') return null;

	const url = toSafeHttpUrl(snapshot.item.url);
	if (!url) return null;

	const thumbnail = snapshot.item.thumbnail;
	if (thumbnail !== null && thumbnail !== undefined) {
		const safeThumbnail = toSafeHttpUrl(thumbnail);
		if (!safeThumbnail) return null;
		return { ...snapshot, item: { ...snapshot.item, url, thumbnail: safeThumbnail } };
	}

	return { ...snapshot, item: { ...snapshot.item, url, thumbnail: null } };
}
