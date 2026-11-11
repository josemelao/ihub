import type { FeedSource, HubData } from '../types';

/** Garante `order` em todas as fontes sem alterar os valores existentes. */
export function normalizeSourceOrders(sources: FeedSource[]): FeedSource[] {
	return sources.map((source, index) => ({ ...source, order: source.order ?? index + 1 }));
}

/** Ordena de forma estável; fontes sem `order` vão para o começo. */
export function sortFeedSources(sources: FeedSource[]): FeedSource[] {
	return [...sources].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function withSourceOrders(hub: HubData): HubData {
	return { ...hub, feedSources: normalizeSourceOrders(hub.feedSources) };
}
