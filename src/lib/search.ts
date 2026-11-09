import Fuse from 'fuse.js';
import { itemHref, itemKind } from './display';
import type { HubData } from './types';

export interface SearchEntry {
	id: string;
	type: 'category' | 'link' | 'app';
	name: string;
	description: string;
	href: string;
	tags: string[];
	categoryName: string;
	groupName?: string;
	color: string;
}

export function buildSearchEntries(hub: HubData): SearchEntry[] {
	const categoryById = new Map(hub.categories.map((category) => [category.id, category]));
	const groupById = new Map(hub.groups.map((group) => [group.id, group]));

	const items = [...hub.items];

	const toEntry = (item: (typeof items)[number]): SearchEntry => {
		const category = categoryById.get(item.categoryId);
		const group = item.groupId ? groupById.get(item.groupId) : undefined;
		return {
			id: `item:${item.id}`,
			type: item.type,
			name: item.name,
			description: [category?.name, group?.name, itemKind(item)].filter(Boolean).join(' · '),
			href: itemHref(item),
			tags: item.tags,
			categoryName: category?.name ?? '',
			groupName: group?.name,
			color: category?.color ?? '#8AA4FF'
		};
	};

	const pinned = items.filter((item) => item.pinned).map(toEntry);
	const rest = items.filter((item) => !item.pinned).map(toEntry);

	const categories: SearchEntry[] = hub.categories
		.slice()
		.sort((a, b) => a.order - b.order)
		.map((category) => ({
			id: `category:${category.id}`,
			type: 'category',
			name: category.name,
			description: `${items.filter((item) => item.categoryId === category.id).length} itens`,
			href: `/c/${category.id}`,
			tags: [],
			categoryName: category.name,
			color: category.color
		}));

	return [...pinned, ...categories, ...rest];
}

function createFuse(entries: SearchEntry[]): Fuse<SearchEntry> {
	return new Fuse(entries, {
		keys: [
			{ name: 'name', weight: 3 },
			{ name: 'tags', weight: 2 },
			{ name: 'categoryName', weight: 1 },
			{ name: 'groupName', weight: 1 },
			{ name: 'description', weight: 0.5 }
		],
		threshold: 0.45,
		ignoreLocation: true,
		ignoreDiacritics: true,
		minMatchCharLength: 1,
		includeScore: true
	});
}

export function searchHub(hub: HubData, query: string, limit = 8): SearchEntry[] {
	const entries = buildSearchEntries(hub);
	const trimmed = query.trim();

	if (!trimmed) {
		return entries.slice(0, limit);
	}

	return createFuse(entries)
		.search(trimmed)
		.slice(0, limit)
		.map((result) => result.item);
}
