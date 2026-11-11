import Fuse from 'fuse.js';
import { itemHref, itemKind, relativeTime } from './display';
import type { FeedCache, HubData } from './types';

export interface SearchEntry {
	id: string;
	type: 'category' | 'link' | 'app' | 'post';
	name: string;
	description: string;
	href: string;
	tags: string[];
	categoryName: string;
	groupName?: string;
	color: string;
}

export function buildSearchEntries(hub: HubData, feed?: FeedCache): SearchEntry[] {
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
			description: [category?.name, group?.name, item.description, itemKind(item)]
				.filter(Boolean)
				.join(' · '),
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

	const sourceById = new Map(hub.feedSources.map((source) => [source.id, source]));
	const posts: SearchEntry[] = (feed?.items ?? [])
		.slice()
		.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
		.slice(0, 20)
		.map((item) => {
			const source = sourceById.get(item.sourceId);
			const category = source ? categoryById.get(source.categoryId) : undefined;
			return {
				id: `post:${item.id}`,
				type: 'post',
				name: item.title,
				description: [source?.name, relativeTime(item.publishedAt)].filter(Boolean).join(' · '),
				href: item.url,
				tags: [],
				categoryName: category?.name ?? '',
				color: category?.color ?? '#8AA4FF'
			};
		});

	return [...pinned, ...categories, ...rest, ...posts];
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

export interface SearchIndex {
	entries: SearchEntry[];
	fuse: Fuse<SearchEntry>;
}

interface IndexCacheEntry {
	feed?: FeedCache;
	index: SearchIndex;
}

const indexCache = new WeakMap<HubData, IndexCacheEntry>();

/** Índice memoizado por identidade de `hub` e `feed` (o app troca objetos, não muta). */
export function searchIndexFor(hub: HubData, feed?: FeedCache): SearchIndex {
	const cached = indexCache.get(hub);
	if (cached && cached.feed === feed) return cached.index;

	const entries = buildSearchEntries(hub, feed);
	const index: SearchIndex = { entries, fuse: createFuse(entries) };
	indexCache.set(hub, { feed, index });
	return index;
}

export function searchHub(hub: HubData, query: string, limit = 8, feed?: FeedCache): SearchEntry[] {
	const { entries, fuse } = searchIndexFor(hub, feed);
	const trimmed = query.trim();

	if (!trimmed) {
		return entries.slice(0, limit);
	}

	return fuse
		.search(trimmed)
		.slice(0, limit)
		.map((result) => result.item);
}
