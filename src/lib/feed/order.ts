import type { FeedSource, HubData } from '../types';

/**
 * Numera `order` de 1..n por categoria, preservando a ordem visual atual
 * (ordem explícita e, para fontes sem `order`, a posição no array).
 */
export function normalizeSourceOrders(sources: FeedSource[]): FeedSource[] {
	const buckets = new Map<string, { source: FeedSource; index: number }[]>();

	sources.forEach((source, index) => {
		const bucket = buckets.get(source.categoryId) ?? [];
		bucket.push({ source, index });
		buckets.set(source.categoryId, bucket);
	});

	const orderById = new Map<string, number>();
	for (const bucket of buckets.values()) {
		bucket
			.slice()
			.sort((a, b) => (a.source.order ?? 0) - (b.source.order ?? 0) || a.index - b.index)
			.forEach(({ source }, position) => orderById.set(source.id, position + 1));
	}

	return sources.map((source) => ({ ...source, order: orderById.get(source.id) ?? 1 }));
}

/** Ordena de forma estável; fontes sem `order` vão para o começo. */
export function sortFeedSources(sources: FeedSource[]): FeedSource[] {
	return [...sources].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * Ordem de exibição das listas planas: categoria pela ordem do hub e, dentro
 * dela, a ordem manual da fonte. Categorias desconhecidas vão para o fim.
 */
export function sortFeedSourcesForDisplay(
	sources: FeedSource[],
	categories: { id: string; order: number }[]
): FeedSource[] {
	const categoryOrder = new Map(categories.map((category) => [category.id, category.order]));

	return [...sources].sort((a, b) => {
		const aCategory = categoryOrder.get(a.categoryId) ?? Number.MAX_SAFE_INTEGER;
		const bCategory = categoryOrder.get(b.categoryId) ?? Number.MAX_SAFE_INTEGER;
		if (aCategory !== bCategory) return aCategory - bCategory;
		if (a.categoryId !== b.categoryId) return a.categoryId.localeCompare(b.categoryId);
		return (a.order ?? 0) - (b.order ?? 0);
	});
}

export function withSourceOrders(hub: HubData): HubData {
	return { ...hub, feedSources: normalizeSourceOrders(hub.feedSources) };
}
