import type { Group, HubData, HubItem } from './types';

export const DEFAULT_QUICK_ACCESS_LIMIT = 9;

interface QuickAccessItemEntry {
	kind: 'item';
	key: string;
	id: string;
	item: HubItem;
}

interface QuickAccessGroupEntry {
	kind: 'group';
	key: string;
	id: string;
	group: Group;
	/** Quantos itens o grupo tem hoje (informativo no tile). */
	count: number;
}

export type QuickAccessEntry = QuickAccessItemEntry | QuickAccessGroupEntry;

export function quickAccessKey(kind: 'item' | 'group', id: string): string {
	return `${kind}:${id}`;
}

function parseKey(key: string): { kind: 'item' | 'group'; id: string } {
	if (key.startsWith('group:')) return { kind: 'group', id: key.slice('group:'.length) };
	if (key.startsWith('item:')) return { kind: 'item', id: key.slice('item:'.length) };
	// Ordem salva antes dos grupos: ids sem prefixo são itens.
	return { kind: 'item', id: key };
}

function canonicalKey(key: string): string {
	const parsed = parseKey(key);
	return quickAccessKey(parsed.kind, parsed.id);
}

/**
 * Entradas do Acesso rápido: itens e grupos fixados, na ordem manual
 * (`settings.quickAccessOrder`) e depois pelo `order`/nome.
 */
export function quickAccessEntries(
	hub: HubData,
	limit: number = DEFAULT_QUICK_ACCESS_LIMIT
): QuickAccessEntry[] {
	const categoryOrder = new Map(hub.categories.map((category) => [category.id, category.order]));
	const countByGroup = new Map<string, number>();
	for (const item of hub.items) {
		if (!item.groupId) continue;
		countByGroup.set(item.groupId, (countByGroup.get(item.groupId) ?? 0) + 1);
	}

	const entryByKey = new Map<string, QuickAccessEntry>();
	for (const item of hub.items) {
		if (!item.pinned) continue;
		const key = quickAccessKey('item', item.id);
		entryByKey.set(key, { kind: 'item', key, id: item.id, item });
	}
	for (const group of hub.groups) {
		if (!group.pinned) continue;
		const key = quickAccessKey('group', group.id);
		entryByKey.set(key, {
			kind: 'group',
			key,
			id: group.id,
			group,
			count: countByGroup.get(group.id) ?? 0
		});
	}

	const result: QuickAccessEntry[] = [];
	const seen = new Set<string>();
	for (const raw of hub.settings.quickAccessOrder ?? []) {
		const key = canonicalKey(raw);
		const entry = entryByKey.get(key);
		if (!entry || seen.has(key)) continue;
		seen.add(key);
		result.push(entry);
	}

	const rest = [...entryByKey.values()].filter((entry) => !seen.has(entry.key));
	rest.sort((a, b) => {
		if (a.kind !== b.kind) return a.kind === 'item' ? -1 : 1;
		if (a.kind === 'item' && b.kind === 'item') {
			return a.item.order - b.item.order || a.item.name.localeCompare(b.item.name, 'pt-BR');
		}
		if (a.kind === 'group' && b.kind === 'group') {
			const categoryA = categoryOrder.get(a.group.categoryId) ?? 0;
			const categoryB = categoryOrder.get(b.group.categoryId) ?? 0;
			return (
				categoryA - categoryB ||
				a.group.order - b.group.order ||
				a.group.name.localeCompare(b.group.name, 'pt-BR')
			);
		}
		return 0;
	});

	result.push(...rest);
	return result.slice(0, limit);
}

/** Move uma entrada uma posição para cima (-1) ou para baixo (+1). */
export function moveQuickAccess(keys: string[], key: string, direction: -1 | 1): string[] {
	const index = keys.indexOf(key);
	if (index < 0) return keys;
	const target = index + direction;
	if (target < 0 || target >= keys.length) return keys;

	const next = [...keys];
	[next[index], next[target]] = [next[target], next[index]];
	return next;
}

/** Aplica a ordem manual a partir da ordem visual atual, preservando o overflow. */
export function quickAccessOrderFor(hub: HubData, visibleKeys: string[]): string[] {
	const visible = new Set(visibleKeys);
	const rest = (hub.settings.quickAccessOrder ?? [])
		.map(canonicalKey)
		.filter((key) => !visible.has(key));
	return [...new Set([...visibleKeys, ...rest])];
}
