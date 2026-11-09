import type { Category, FeedCache, FeedItem, FeedSource, HubData, HubState } from '../types';
import { matchesSourceRules } from './filter';

export interface FeedViewItem {
	item: FeedItem;
	source: FeedSource;
	category?: Category;
	read: boolean;
	saved: boolean;
}

export function buildFeedView(
	hub: HubData,
	cache: FeedCache,
	state: HubState,
	options: { categoryId?: string; savedOnly?: boolean } = {}
): FeedViewItem[] {
	const sourceById = new Map(hub.feedSources.map((source) => [source.id, source]));
	const categoryById = new Map(hub.categories.map((category) => [category.id, category]));
	const saved = new Set(state.saved);
	const result: FeedViewItem[] = [];

	for (const item of cache.items) {
		const source = sourceById.get(item.sourceId);
		if (!source || !source.enabled) continue;
		if (options.categoryId && source.categoryId !== options.categoryId) continue;
		if (!matchesSourceRules(item, source)) continue;
		if (options.savedOnly && !saved.has(item.id)) continue;

		result.push({
			item,
			source,
			category: categoryById.get(source.categoryId),
			read: Boolean(state.read[item.id]),
			saved: saved.has(item.id)
		});
	}

	return result.sort((a, b) => (b.item.publishedAt || '').localeCompare(a.item.publishedAt || ''));
}
