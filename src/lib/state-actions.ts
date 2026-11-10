import { toSafeHttpUrl } from './net/url';
import type { HubState, SavedItemSnapshot } from './types';

export type StateAction = 'read' | 'unread' | 'save' | 'unsave' | 'mark-all-read' | 'mark-unread';

export interface StatePayload {
	action?: StateAction;
	id?: string;
	ids?: string[];
	snapshot?: SavedItemSnapshot;
}

export type StateActionResult = { ok: true; state: HubState } | { ok: false; error: string };

function invalid(error: string): StateActionResult {
	return { ok: false, error };
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

export function applyStateAction(
	state: HubState,
	payload: StatePayload,
	now: string
): StateActionResult {
	const next: HubState = {
		version: state.version,
		read: { ...state.read },
		saved: [...state.saved],
		savedItems: { ...state.savedItems },
		...(state.lastPrunedAt ? { lastPrunedAt: state.lastPrunedAt } : {})
	};

	switch (payload.action) {
		case 'read':
			if (!payload.id) return invalid('Informe o id do post.');
			next.read[payload.id] = now;
			break;

		case 'unread':
			if (!payload.id) return invalid('Informe o id do post.');
			delete next.read[payload.id];
			break;

		case 'save':
			if (!payload.id) return invalid('Informe o id do post.');
			next.saved = [...new Set([...next.saved, payload.id])];
			if (payload.snapshot) {
				const snapshot = safeSnapshot(payload.snapshot, payload.id);
				if (!snapshot) {
					return invalid('Snapshot inválido: item, URL ou thumbnail não são seguros.');
				}
				next.savedItems[payload.id] = { ...snapshot, savedAt: now };
			}
			break;

		case 'unsave':
			if (!payload.id) return invalid('Informe o id do post.');
			next.saved = next.saved.filter((id) => id !== payload.id);
			delete next.savedItems[payload.id];
			break;

		case 'mark-all-read':
			if (!Array.isArray(payload.ids)) return invalid('Envie a lista de ids.');
			for (const id of payload.ids) {
				if (typeof id === 'string') next.read[id] = now;
			}
			break;

		case 'mark-unread':
			if (!Array.isArray(payload.ids)) return invalid('Envie a lista de ids.');
			for (const id of payload.ids) {
				if (typeof id === 'string') delete next.read[id];
			}
			break;

		default:
			return invalid('Ação inválida.');
	}

	return { ok: true, state: next };
}
