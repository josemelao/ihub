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
import { removeTag, renameTag } from './tags';
import { quickAccessKey } from './quick-access';
import type { HubData } from './types';

export interface HubPayload {
	action?: string;
	id?: string;
	direction?: 'up' | 'down';
	categoryId?: string;
	groupId?: string | null;
	from?: string;
	to?: string;
	tag?: string;
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

/** Coloca a chave na frente do acesso rápido (item/grupo recém-fixado). */
function pinFirst(hub: HubData, kind: 'item' | 'group', id: string): HubData {
	const key = quickAccessKey(kind, id);
	const order = (hub.settings.quickAccessOrder ?? []).filter(
		(entry) => entry !== key && entry !== id
	);
	return { ...hub, settings: { ...hub.settings, quickAccessOrder: [key, ...order] } };
}

/** Remove a chave da ordem ao desafixar (aceita ids legados para itens). */
function unpinKey(hub: HubData, kind: 'item' | 'group', id: string): HubData {
	const order = hub.settings.quickAccessOrder;
	if (!order) return hub;
	const key = quickAccessKey(kind, id);
	const next = order.filter((entry) => entry !== key && !(kind === 'item' && entry === id));
	return { ...hub, settings: { ...hub.settings, quickAccessOrder: next } };
}

export function applyHubAction(hub: HubData, payload: HubPayload): HubData {
	switch (payload.action) {
		case 'add-item': {
			if (!payload.item) throw new Error('Informe o item.');
			const next =
				payload.item.type === 'app'
					? addApp(hub, payload.item as AppInput)
					: addLink(hub, payload.item as LinkInput);
			if (!payload.item.pinned) return next;
			const added = next.items.find((item) => !hub.items.some((old) => old.id === item.id));
			return added ? pinFirst(next, 'item', added.id) : next;
		}

		case 'update-item': {
			const id = requireId(payload);
			const wasPinned = hub.items.find((item) => item.id === id)?.pinned ?? false;
			const next = updateItem(hub, id, payload.patch ?? {});
			if (payload.patch?.pinned === true && !wasPinned) return pinFirst(next, 'item', id);
			if (payload.patch?.pinned === false) return unpinKey(next, 'item', id);
			return next;
		}

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

		case 'remove-tag': {
			if (!payload.tag?.trim()) throw new Error('Informe a tag.');
			return removeTag(hub, payload.tag);
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

		case 'add-group': {
			if (!payload.group) throw new Error('Informe o grupo.');
			const next = addGroup(hub, payload.group);
			if (!payload.group.pinned) return next;
			const added = next.groups.find((group) => !hub.groups.some((old) => old.id === group.id));
			return added ? pinFirst(next, 'group', added.id) : next;
		}

		case 'update-group': {
			const id = requireId(payload);
			const wasPinned = hub.groups.find((group) => group.id === id)?.pinned ?? false;
			const next = updateGroup(hub, id, payload.groupPatch ?? {});
			if (payload.groupPatch?.pinned === true && !wasPinned) return pinFirst(next, 'group', id);
			if (payload.groupPatch?.pinned === false) return unpinKey(next, 'group', id);
			return next;
		}

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
