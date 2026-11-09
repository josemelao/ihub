import { describe, it, expect } from 'vitest';
import { refreshFeed, type Fetcher } from './refresh';
import type { FeedCache, FeedItem, FeedSource, HubData } from '../types';

const rss = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item>
    <title>Notas do patch</title>
    <link>https://good.test/patch</link>
    <description>Correções</description>
    <pubDate>Mon, 09 Nov 2026 12:00:00 GMT</pubDate>
    <guid>good-1</guid>
  </item>
</channel></rss>`;

const source = (overrides: Partial<FeedSource>): FeedSource => ({
	id: 'good',
	type: 'rss',
	name: 'Bom',
	target: 'https://good.test/feed',
	categoryId: 'jogos',
	intervalMinutes: 30,
	enabled: true,
	include: [],
	exclude: [],
	matchMode: 'any',
	...overrides
});

const hub = (sources: FeedSource[]): HubData => ({
	version: 1,
	settings: { accent: '#8AA4FF' },
	categories: [{ id: 'jogos', name: 'Jogos', color: '#8AA4FF', order: 1 }],
	groups: [],
	items: [],
	feedSources: sources,
	savedFilters: []
});

const cache = (items: FeedItem[] = [], sources: FeedCache['sources'] = {}): FeedCache => ({
	version: 1,
	updatedAt: '2026-11-01T00:00:00.000Z',
	items,
	sources
});

const now = () => new Date('2026-11-09T12:00:00.000Z');

describe('refreshFeed', () => {
	it('atualiza fontes boas e isola a falha das ruins', async () => {
		const failing = source({ id: 'bad', name: 'Ruim', target: 'https://bad.test/feed' });
		const fetcher: Fetcher = async (input) => {
			if (String(input).includes('bad.test')) throw new Error('HTTP 429');
			return new Response(rss, { status: 200 });
		};

		const result = await refreshFeed(hub([source({}), failing]), cache(), {
			fetcher,
			now,
			force: true
		});

		expect(result.results.find((r) => r.sourceId === 'good')?.ok).toBe(true);
		expect(result.results.find((r) => r.sourceId === 'bad')?.ok).toBe(false);
		expect(result.cache.items).toHaveLength(1);
		expect(result.cache.items[0].sourceId).toBe('good');
		expect(result.cache.sources.good.error).toBeNull();
		expect(result.cache.sources.bad.error).toContain('429');
		expect(result.cache.sources.bad.lastFetchedAt).toBe(now().toISOString());
	});

	it('preserva posts antigos de uma fonte que falhou', async () => {
		const old: FeedItem = {
			id: 'old',
			sourceId: 'bad',
			title: 'Antigo',
			summary: '',
			url: 'https://bad.test/old',
			publishedAt: '2026-11-08T00:00:00.000Z',
			thumbnail: null
		};
		const fetcher: Fetcher = async () => {
			throw new Error('offline');
		};

		const result = await refreshFeed(
			hub([source({ id: 'bad', name: 'Ruim', target: 'https://bad.test/feed' })]),
			cache([old]),
			{ fetcher, now, force: true }
		);

		expect(result.cache.items.map((item) => item.id)).toContain('old');
	});

	it('não busca de novo antes do intervalo', async () => {
		let calls = 0;
		const fetcher: Fetcher = async () => {
			calls += 1;
			return new Response(rss, { status: 200 });
		};
		const filled = cache([], {
			good: { lastFetchedAt: now().toISOString(), error: null, count: 1 }
		});

		const result = await refreshFeed(hub([source({})]), filled, { fetcher, now });

		expect(calls).toBe(0);
		expect(result.results[0].skipped).toBe(true);
	});

	it('força a busca quando solicitado', async () => {
		let calls = 0;
		const fetcher: Fetcher = async () => {
			calls += 1;
			return new Response(rss, { status: 200 });
		};
		const filled = cache([], {
			good: { lastFetchedAt: now().toISOString(), error: null, count: 1 }
		});

		await refreshFeed(hub([source({})]), filled, { fetcher, now, force: true });
		expect(calls).toBe(1);
	});

	it('limita a quantidade de posts por fonte', async () => {
		const many = `<?xml version="1.0"?><rss version="2.0"><channel>
			${Array.from(
				{ length: 5 },
				(_, i) => `<item><title>Post ${i}</title><link>https://good.test/${i}</link><description>x</description><pubDate>Mon, 09 Nov 2026 12:00:00 GMT</pubDate><guid>g${i}</guid></item>`
			).join('')}
		</channel></rss>`;
		const fetcher: Fetcher = async () => new Response(many, { status: 200 });

		const result = await refreshFeed(hub([source({})]), cache(), {
			fetcher,
			now,
			force: true,
			maxPerSource: 2
		});

		expect(result.cache.items).toHaveLength(2);
	});
});
