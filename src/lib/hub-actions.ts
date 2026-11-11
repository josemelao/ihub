import {
	addApp,
	addCategory,
	addGroup,
	addLink,
	addSavedFilter,
	addSource,
	moveCategory,
	moveGroup,
	moveItem,
	moveItemTo,
	moveSource,
	removeCategory,
	removeGroup,
	removeItem,
	removeSavedFilter,
	removeSource,
	toggleSource,
	updateCategory,
	updateGroup,
	updateItem,
	updateSource,
	updateSavedFilter,
	updateSettings,
	type AppInput,
	type CategoryInput,
	type GroupInput,
	type ItemPatch,
	type LinkInput,
	type SavedFilterInput,
	type SettingsInput,
	type SourceInput,
	type SourcePatch
} from './hub-edit';
import { renameTag } from './tags';
import type { HubData } from './types';

export interface HubPayload {
	action?: string;
	id?: string;
	direction?: 'up' | 'down';
	categoryId?: string;
	groupId?: string | null;
	from?: string;
	to?: string;
	item?: (LinkInput | AppInput) & { type?: 'link' | 'app' };
	patch?: ItemPatch;
	source?: SourceInput;
	sourcePatch?: SourcePatch;
	category?: CategoryInput;
	group?: GroupInput;
	groupPatch?: Partial<GroupInput>;
	filter?: SavedFilterInput;
	settings?: SettingsInput;
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

		case 'move-item-to': {
			if (!payload.categoryId) throw new Error('Informe a categoria.');
			return moveItemTo(hub, requireId(payload), payload.categoryId, payload.groupId ?? null);
		}

		case 'move-source':
			return moveSource(hub, requireId(payload), requireDirection(payload));

		case 'rename-tag': {
			if (!payload.from || !payload.to) {
				throw new Error('Informe a tag atual e o novo nome.');
			}
			return renameTag(hub, payload.from, payload.to);
		}

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

		case 'add-group':
			if (!payload.group) throw new Error('Informe o grupo.');
			return addGroup(hub, payload.group);

		case 'update-group':
			return updateGroup(hub, requireId(payload), payload.groupPatch ?? {});

		case 'delete-group':
			return removeGroup(hub, requireId(payload));

		case 'move-group':
			return moveGroup(hub, requireId(payload), requireDirection(payload));

		case 'delete-category':
			return removeCategory(hub, requireId(payload));

		case 'update-category':
			return updateCategory(hub, requireId(payload), payload.category ?? {});

		case 'move-category':
			return moveCategory(hub, requireId(payload), requireDirection(payload));

		case 'update-settings':
			return updateSettings(hub, payload.settings ?? {});

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
