import type {
	Category,
	FeedCache,
	FeedItem,
	FeedSource,
	HubData,
	HubState,
	SavedItemSnapshot
} from '../types';
import { matchesSourceRules } from './filter';

export interface FeedViewItem {
	item: FeedItem;
	source: FeedSource;
	category?: Category;
	read: boolean;
	saved: boolean;
	savedAt?: string;
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
		if (!options.savedOnly && !matchesSourceRules(item, source)) continue;
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

export function snapshotFromEntry(entry: FeedViewItem): SavedItemSnapshot {
	return {
		item: entry.item,
		sourceId: entry.source.id,
		sourceName: entry.source.name,
		categoryId: entry.source.categoryId,
		categoryName: entry.category?.name,
		color: entry.category?.color,
		savedAt: new Date().toISOString()
	};
}

export function buildSavedView(hub: HubData, cache: FeedCache, state: HubState): FeedViewItem[] {
	const sourceById = new Map(hub.feedSources.map((source) => [source.id, source]));
	const categoryById = new Map(hub.categories.map((category) => [category.id, category]));
	const itemById = new Map(cache.items.map((item) => [item.id, item]));
	const result: FeedViewItem[] = [];

	for (const id of state.saved) {
		const liveItem = itemById.get(id);
		const liveSource = liveItem ? sourceById.get(liveItem.sourceId) : undefined;

		if (liveItem && liveSource) {
			result.push({
				item: liveItem,
				source: liveSource,
				category: categoryById.get(liveSource.categoryId),
				read: Boolean(state.read[id]),
				saved: true,
				savedAt: state.savedItems?.[id]?.savedAt
			});
			continue;
		}

		const snapshot = state.savedItems?.[id];
		if (!snapshot) continue;

		const knownCategory = snapshot.categoryId ? categoryById.get(snapshot.categoryId) : undefined;
		const category: Category = knownCategory ?? {
			id: snapshot.categoryId ?? 'saved',
			name: snapshot.categoryName ?? 'Salvos',
			color: snapshot.color ?? '#8AA4FF',
			order: 9999
		};
		const source: FeedSource = {
			id: snapshot.sourceId,
			type: 'rss',
			name: snapshot.sourceName,
			target: '',
			categoryId: category.id,
			intervalMinutes: 0,
			enabled: true,
			include: [],
			exclude: [],
			matchMode: 'any'
		};

		result.push({
			item: snapshot.item,
			source,
			category,
			read: Boolean(state.read[id]),
			saved: true,
			savedAt: snapshot.savedAt
		});
	}

	return result.sort((a, b) =>
		(b.savedAt ?? b.item.publishedAt ?? '').localeCompare(a.savedAt ?? a.item.publishedAt ?? '')
	);
}

export function backfillSavedSnapshots(hub: HubData, cache: FeedCache, state: HubState): HubState {
	const missing = state.saved.filter((id) => !state.savedItems[id]);
	if (missing.length === 0) return state;

	const sourceById = new Map(hub.feedSources.map((source) => [source.id, source]));
	const categoryById = new Map(hub.categories.map((category) => [category.id, category]));
	const itemById = new Map(cache.items.map((item) => [item.id, item]));
	const savedItems = { ...state.savedItems };
	let changed = false;

	for (const id of missing) {
		const item = itemById.get(id);
		if (!item) continue;
		const source = sourceById.get(item.sourceId);
		if (!source) continue;
		const category = categoryById.get(source.categoryId);
		savedItems[id] = {
			item,
			sourceId: source.id,
			sourceName: source.name,
			categoryId: source.categoryId,
			categoryName: category?.name,
			color: category?.color,
			savedAt: new Date().toISOString()
		};
		changed = true;
	}

	return changed ? { ...state, savedItems } : state;
}
