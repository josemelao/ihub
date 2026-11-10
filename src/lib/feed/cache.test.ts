import { describe, expect, it } from 'vitest';
import { removeSourceFromCache, sourceCacheIsStale } from './cache';
import type { FeedCache, FeedSource } from '../types';

const cache: FeedCache = {
	version: 1,
	updatedAt: '2026-11-09T12:00:00Z',
	items: [
		{
			id: 'a',
			sourceId: 'fonte-a',
			title: 'A',
			summary: '',
			url: 'https://example.com/a',
			publishedAt: '2026-11-09T11:00:00Z',
			thumbnail: null
		},
		{
			id: 'b',
			sourceId: 'fonte-b',
			title: 'B',
			summary: '',
			url: 'https://example.com/b',
			publishedAt: '2026-11-09T10:00:00Z',
			thumbnail: null
		}
	],
	sources: {
		'fonte-a': { lastFetchedAt: '2026-11-09T12:00:00Z', error: null, count: 1 },
		'fonte-b': { lastFetchedAt: '2026-11-09T12:00:00Z', error: null, count: 1 }
	}
};

const source = (overrides: Partial<FeedSource> = {}): FeedSource => ({
	id: 'fonte-a',
	type: 'rss',
	name: 'Fonte A',
	target: 'https://example.com/feed',
	categoryId: 'jogos',
	intervalMinutes: 30,
	enabled: true,
	include: [],
	exclude: [],
	matchMode: 'any',
	...overrides
});

describe('removeSourceFromCache', () => {
	it('remove itens e status apenas da fonte pedida', () => {
		const result = removeSourceFromCache(cache, 'fonte-a');
		expect(result.items.map((item) => item.id)).toEqual(['b']);
		expect(result.sources['fonte-a']).toBeUndefined();
		expect(result.sources['fonte-b']).toBeDefined();
	});
});

describe('sourceCacheIsStale', () => {
	it('detecta mudança de target ou tipo', () => {
		expect(sourceCacheIsStale(source(), source({ target: 'https://example.com/novo' }))).toBe(true);
		expect(sourceCacheIsStale(source(), source({ type: 'youtube' }))).toBe(true);
		expect(sourceCacheIsStale(source(), source({ name: 'Outro nome' }))).toBe(false);
	});
});
