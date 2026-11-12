import type { HubData, HubItem } from './types';

export const DEFAULT_QUICK_ACCESS_LIMIT = 6;

/**
 * Itens fixados na ordem de `settings.quickAccessOrder`; ids sem posição
 * explícita entram depois, ordenados por `order` e nome.
 */
export function quickAccessItems(hub: HubData, limit?: number): HubItem[] {
	const pinned = hub.items.filter((item) => item.pinned);
	const order = hub.settings.quickAccessOrder ?? [];
	const rank = new Map(order.map((id, index) => [id, index]));

	const sorted = [...pinned].sort((a, b) => {
		const rankA = rank.get(a.id);
		const rankB = rank.get(b.id);
		if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
		if (rankA !== undefined) return -1;
		if (rankB !== undefined) return 1;
		return a.order - b.order || a.name.localeCompare(b.name, 'pt-BR');
	});

	const max = limit ?? hub.settings.quickAccessLimit ?? DEFAULT_QUICK_ACCESS_LIMIT;
	return sorted.slice(0, max);
}

/** Move um id uma posição para cima (-1) ou para baixo (+1). */
export function moveQuickAccess(ids: string[], id: string, direction: -1 | 1): string[] {
	const index = ids.indexOf(id);
	if (index < 0) return ids;
	const target = index + direction;
	if (target < 0 || target >= ids.length) return ids;

	const next = [...ids];
	[next[index], next[target]] = [next[target], next[index]];
	return next;
}

/** Aplica a ordem manual a partir da ordem visual atual dos itens fixados. */
export function quickAccessOrderFor(hub: HubData, visibleIds: string[]): string[] {
	const current = hub.settings.quickAccessOrder ?? [];
	const visible = new Set(visibleIds);
	const rest = current.filter((id) => !visible.has(id));
	return [...new Set([...visibleIds, ...rest])];
}
