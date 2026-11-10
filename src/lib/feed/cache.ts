import type { FeedCache, FeedSource, HubData } from '../types';

export function removeSourceFromCache(cache: FeedCache, sourceId: string): FeedCache {
	return {
		...cache,
		items: cache.items.filter((item) => item.sourceId !== sourceId),
		sources: Object.fromEntries(Object.entries(cache.sources).filter(([id]) => id !== sourceId))
	};
}

/** Remove itens/status de fontes que não existem mais no hub. */
export function pruneOrphanFeedCache(
	hub: HubData,
	cache: FeedCache
): { cache: FeedCache; removed: number } {
	const sourceIds = new Set(hub.feedSources.map((source) => source.id));
	const items = cache.items.filter((item) => sourceIds.has(item.sourceId));
	const sources = Object.fromEntries(
		Object.entries(cache.sources).filter(([id]) => sourceIds.has(id))
	);

	const removed =
		cache.items.length -
		items.length +
		(Object.keys(cache.sources).length - Object.keys(sources).length);

	if (removed === 0) return { cache, removed: 0 };
	return { cache: { ...cache, items, sources }, removed };
}

export function sourceCacheIsStale(
	previous: FeedSource | undefined,
	next: FeedSource | undefined
): boolean {
	if (!previous || !next) return false;
	return previous.target !== next.target || previous.type !== next.type;
}
