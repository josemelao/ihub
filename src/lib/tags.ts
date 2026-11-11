import type { HubData, HubItem } from './types';

/** Chave de comparação: sem caixa, acento ou espaços extras. */
export function tagKey(value: string): string {
	return value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.trim()
		.replace(/\s+/g, ' ')
		.toLowerCase();
}

export function cleanTag(value: string): string {
	return value.trim().replace(/\s+/g, ' ');
}

/** Remove vazias e duplicatas, preservando a primeira grafia. */
export function normalizeTags(tags: string[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];

	for (const raw of tags) {
		const tag = cleanTag(raw);
		if (!tag) continue;
		const key = tagKey(tag);
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(tag);
	}

	return result;
}

export interface TagCount {
	tag: string;
	key: string;
	count: number;
}

export function collectTags(hub: HubData): TagCount[] {
	const counts = new Map<string, TagCount>();

	for (const item of hub.items) {
		for (const tag of normalizeTags(item.tags)) {
			const key = tagKey(tag);
			const current = counts.get(key);
			if (current) current.count += 1;
			else counts.set(key, { tag, key, count: 1 });
		}
	}

	return [...counts.values()].sort(
		(a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'pt-BR')
	);
}

export function itemHasTag(item: HubItem, tag: string): boolean {
	const key = tagKey(tag);
	return normalizeTags(item.tags).some((candidate) => tagKey(candidate) === key);
}

export function renameTag(hub: HubData, from: string, to: string): HubData {
	const fromKey = tagKey(from);
	const nextTag = cleanTag(to);
	if (!fromKey) return hub;
	if (!nextTag) throw new Error('Informe o novo nome da tag.');

	return {
		...hub,
		items: hub.items.map((item) => {
			if (!item.tags.some((tag) => tagKey(tag) === fromKey)) return item;
			return {
				...item,
				tags: normalizeTags(item.tags.map((tag) => (tagKey(tag) === fromKey ? nextTag : tag)))
			};
		})
	};
}

/** Normaliza as tags de todos os itens no load. */
export function withNormalizedTags(hub: HubData): HubData {
	return {
		...hub,
		items: hub.items.map((item) => ({ ...item, tags: normalizeTags(item.tags) }))
	};
}
