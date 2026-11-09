import {
	addApp,
	addCategory,
	addLink,
	addSavedFilter,
	addSource,
	moveCategory,
	moveItem,
	removeCategory,
	removeItem,
	removeSavedFilter,
	removeSource,
	toggleSource,
	updateCategory,
	updateItem,
	updateSource,
	updateSavedFilter,
	type AppInput,
	type CategoryInput,
	type ItemPatch,
	type LinkInput,
	type SavedFilterInput,
	type SourceInput,
	type SourcePatch
} from './hub-edit';
import type { HubData } from './types';

export interface HubPayload {
	action?: string;
	id?: string;
	direction?: 'up' | 'down';
	item?: (LinkInput | AppInput) & { type?: 'link' | 'app' };
	patch?: ItemPatch;
	source?: SourceInput;
	sourcePatch?: SourcePatch;
	category?: CategoryInput;
	filter?: SavedFilterInput;
}

function requireId(payload: HubPayload): string {
	if (!payload.id) throw new Error('Informe o id.');
	return payload.id;
}

function requireDirection(payload: HubPayload): 'up' | 'down' {
	if (payload.direction !== 'up' && payload.direction !== 'down') {
		throw new Error("Direção inválida: use 'up' ou 'down'.");
	}
	return payload.direction;
}

export function applyHubAction(hub: HubData, payload: HubPayload): HubData {
	switch (payload.action) {
		case 'add-item': {
			if (!payload.item) throw new Error('Informe o item.');
			return payload.item.type === 'app'
				? addApp(hub, payload.item as AppInput)
				: addLink(hub, payload.item as LinkInput);
		}

		case 'update-item':
			return updateItem(hub, requireId(payload), payload.patch ?? {});

		case 'delete-item':
			return removeItem(hub, requireId(payload));

		case 'move-item':
			return moveItem(hub, requireId(payload), requireDirection(payload));

		case 'add-source':
			if (!payload.source) throw new Error('Informe a fonte.');
			return addSource(hub, payload.source);

		case 'update-source':
			return updateSource(hub, requireId(payload), payload.sourcePatch ?? {});

		case 'delete-source':
			return removeSource(hub, requireId(payload));

		case 'toggle-source':
			return toggleSource(hub, requireId(payload));

		case 'add-category':
			if (!payload.category) throw new Error('Informe a categoria.');
			return addCategory(hub, payload.category);

		case 'delete-category':
			return removeCategory(hub, requireId(payload));

		case 'update-category':
			return updateCategory(hub, requireId(payload), payload.category ?? {});

		case 'move-category':
			return moveCategory(hub, requireId(payload), requireDirection(payload));

		case 'add-filter':
			if (!payload.filter) throw new Error('Informe o filtro.');
			return addSavedFilter(hub, payload.filter);

		case 'update-filter':
			if (!payload.filter) throw new Error('Informe o filtro.');
			return updateSavedFilter(hub, requireId(payload), payload.filter);

		case 'delete-filter':
			return removeSavedFilter(hub, requireId(payload));

		default:
			throw new Error('Ação inválida.');
	}
}
