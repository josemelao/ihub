import { beforeEach, describe, it, expect, vi } from 'vitest';
import { fetchPublicText, type FetchTextOptions } from '../net/safe-fetch';
import { refreshFeed, type Fetcher } from './refresh';
import type { FeedCache, FeedItem, FeedSource, HubData } from '../types';

vi.mock('../net/safe-fetch', () => ({
	fetchPublicText: vi.fn()
}));

const fetchTextMock = vi.mocked(fetchPublicText);
const defaultFetchText = async (target: string, options: FetchTextOptions = {}) => {
	const fetcher = options.fetcher ?? fetch;
	const response = await fetcher(target);
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return { text: await response.text(), finalUrl: target };
};

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

beforeEach(() => {
	fetchTextMock.mockReset();
	fetchTextMock.mockImplementation(defaultFetchText);
});

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
				(_, i) =>
					`<item><title>Post ${i}</title><link>https://good.test/${i}</link><description>x</description><pubDate>Mon, 09 Nov 2026 12:00:00 GMT</pubDate><guid>g${i}</guid></item>`
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

	it('respeita o limite específico da fonte', async () => {
		const many = `<?xml version="1.0"?><rss version="2.0"><channel>
			${Array.from(
				{ length: 5 },
				(_, i) =>
					`<item><title>Post ${i}</title><link>https://good.test/${i}</link><description>x</description><pubDate>Mon, 09 Nov 2026 12:00:00 GMT</pubDate><guid>g${i}</guid></item>`
			).join('')}
		</channel></rss>`;
		const fetcher: Fetcher = async () => new Response(many, { status: 200 });

		const result = await refreshFeed(hub([source({ maxItems: 1 })]), cache(), {
			fetcher,
			now,
			force: true,
			maxPerSource: 4
		});

		expect(result.cache.items).toHaveLength(1);
	});

	it('atualiza só a fonte pedida', async () => {
		const calls: string[] = [];
		const fetcher: Fetcher = async (input) => {
			calls.push(String(input));
			return new Response(rss, { status: 200 });
		};
		const other = source({ id: 'other', name: 'Outra', target: 'https://other.test/feed' });

		await refreshFeed(hub([source({}), other]), cache(), {
			fetcher,
			now,
			force: true,
			sourceId: 'other'
		});

		expect(calls).toEqual(['https://other.test/feed']);
	});

	it('resolve @handle do YouTube antes de buscar o feed', async () => {
		const channelId = 'UCy7DyzEEC9h81lmwg6H5rlw';
		fetchTextMock.mockImplementation(async (target, options) =>
			String(target).includes('youtube.com/@canal')
				? { text: `<meta itemprop="identifier" content="${channelId}">`, finalUrl: String(target) }
				: defaultFetchText(String(target), options)
		);
		const calls: string[] = [];
		const fetcher: Fetcher = async (input) => {
			calls.push(String(input));
			return new Response(rss, { status: 200 });
		};

		const result = await refreshFeed(
			hub([source({ id: 'yt', type: 'youtube', name: 'YT', target: '@canal' })]),
			cache(),
			{ fetcher, now, force: true }
		);

		expect(calls[0]).toBe(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
		expect(result.cache.items).toHaveLength(1);
		expect(result.results[0].ok).toBe(true);
	});
});
