import type { HubItem } from '../types';

const TRACKING_PARAM = /^(utm_|fbclid$|gclid$|dclid$|msclkid$|mc_cid$|mc_eid$|igshid$)/i;

/**
 * Normaliza uma URL http(s) para comparar duplicados: caixa do host, `www`,
 * barra final, hash, parâmetros de rastreamento e ordem da query.
 */
export function normalizeLinkUrl(value: string): string | null {
	let url: URL;
	try {
		url = new URL(value.trim());
	} catch {
		return null;
	}

	if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
	if (url.username || url.password) return null;

	const host = url.hostname.toLowerCase().replace(/^www\./, '');
	const path = url.pathname.replace(/\/+$/, '') || '/';
	const params = [...url.searchParams.entries()]
		.filter(([key]) => !TRACKING_PARAM.test(key))
		.sort(([left], [right]) => left.localeCompare(right));
	const search = params.length > 0 ? `?${new URLSearchParams(params).toString()}` : '';
	const port = url.port ? `:${url.port}` : '';

	return `${url.protocol}//${host}${port}${path}${search}`;
}

export interface DuplicateGroup {
	key: string;
	items: HubItem[];
}

/** Agrupa links cujo endereço normalizado coincide. */
export function findDuplicateGroups(items: HubItem[]): DuplicateGroup[] {
	const groups = new Map<string, HubItem[]>();

	for (const item of items) {
		if (item.type !== 'link') continue;
		const key = normalizeLinkUrl(item.url);
		if (!key) continue;
		const group = groups.get(key);
		if (group) group.push(item);
		else groups.set(key, [item]);
	}

	return [...groups.entries()]
		.filter(([, group]) => group.length > 1)
		.map(([key, group]) => ({ key, items: group }))
		.sort((left, right) => left.key.localeCompare(right.key));
}

export function duplicateItemIds(groups: DuplicateGroup[]): Set<string> {
	return new Set(groups.flatMap((group) => group.items.map((item) => item.id)));
}
