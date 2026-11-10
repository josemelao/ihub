import type { FeedCache, FeedSource } from '../types';

export function removeSourceFromCache(cache: FeedCache, sourceId: string): FeedCache {
	return {
		...cache,
		items: cache.items.filter((item) => item.sourceId !== sourceId),
		sources: Object.fromEntries(Object.entries(cache.sources).filter(([id]) => id !== sourceId))
	};
}

export function sourceCacheIsStale(
	previous: FeedSource | undefined,
	next: FeedSource | undefined
): boolean {
	if (!previous || !next) return false;
	return previous.target !== next.target || previous.type !== next.type;
}
