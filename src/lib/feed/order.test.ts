import { describe, expect, it } from 'vitest';
import { EMPTY_HUB } from '../defaults';
import { parseHub } from '../schema';
import type { FeedSource, HubData } from '../types';
import { normalizeSourceOrders, sortFeedSources, withSourceOrders } from './order';

function source(id: string, overrides: Partial<FeedSource> = {}): FeedSource {
	return {
		id,
		type: 'rss',
		name: id,
		target: `https://example.com/${id}.xml`,
		categoryId: 'c',
		intervalMinutes: 30,
		enabled: true,
		include: [],
		exclude: [],
		matchMode: 'any',
		...overrides
	};
}

function hubWith(sources: FeedSource[]): HubData {
	const hub = structuredClone(EMPTY_HUB);
	hub.categories = [{ id: 'c', name: 'C', color: '#8AA4FF', order: 1 }];
	hub.feedSources = sources;
	return hub;
}

describe('normalizeSourceOrders', () => {
	it('renumera de 1..n preservando a ordem visual', () => {
		const sources = [source('a'), source('b', { order: 7 }), source('c')];
		// a (sem order = 0) primeiro, depois b (7) e c (0, empate resolvido pela posição)
		expect(normalizeSourceOrders(sources).map((entry) => entry.order)).toEqual([1, 3, 2]);
	});

	it('does not mutate the original sources', () => {
		const sources = [source('a')];
		normalizeSourceOrders(sources);
		expect(sources[0].order).toBeUndefined();
	});
});

describe('sortFeedSources', () => {
	it('sorts by order and keeps equal orders stable', () => {
		const sources = [
			source('c', { order: 2 }),
			source('a', { order: 1 }),
			source('b', { order: 2 })
		];
		expect(sortFeedSources(sources).map((entry) => entry.id)).toEqual(['a', 'c', 'b']);
	});

	it('treats missing order as zero', () => {
		const sources = [source('b', { order: 2 }), source('a')];
		expect(sortFeedSources(sources).map((entry) => entry.id)).toEqual(['a', 'b']);
	});
});

describe('withSourceOrders', () => {
	it('returns a hub with normalized orders', () => {
		const hub = withSourceOrders(hubWith([source('a'), source('b')]));
		expect(hub.feedSources.map((entry) => entry.order)).toEqual([1, 2]);
	});

	it('is applied by parseHub', () => {
		const parsed = parseHub(hubWith([source('a'), source('b')]));
		expect(parsed.feedSources.map((entry) => entry.order)).toEqual([1, 2]);
	});
});
