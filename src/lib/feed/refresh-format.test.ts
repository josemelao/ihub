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

const source = (overrides: Partial<FeedSource> = {}): FeedSource => ({
	id: 'bom',
	type: 'rss',
	name: 'Bom',
	target: 'https://bom.test/feed',
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

const previous: FeedItem = {
	id: 'antigo',
	sourceId: 'bom',
	title: 'Post antigo',
	summary: '',
	url: 'https://bom.test/post-antigo',
	publishedAt: '2026-11-01T00:00:00.000Z',
	thumbnail: null
};

const now = () => new Date('2026-11-09T12:00:00.000Z');

beforeEach(() => {
	fetchTextMock.mockReset();
	fetchTextMock.mockImplementation(defaultFetchText);
});

describe('refreshFeed rejeita conteúdo que não é feed', () => {
	it('marca erro quando a URL devolve uma página HTML', async () => {
		const fetcher: Fetcher = async () =>
			new Response('<html><body><h1>Site</h1></body></html>', {
				status: 200,
				headers: { 'content-type': 'text/html' }
			});

		const result = await refreshFeed(hub([source()]), cache([previous]), {
			fetcher,
			now,
			force: true
		});

		expect(result.results[0]).toMatchObject({ ok: false, count: 0 });
		expect(result.cache.sources.bom.error).toMatch(/feed/i);
		expect(result.cache.items.map((item) => item.id)).toEqual(['antigo']);
	});

	it('marca erro quando o XML está malformado', async () => {
		const fetcher: Fetcher = async () => new Response('<rss><channel><item>', { status: 200 });

		const result = await refreshFeed(hub([source()]), cache([previous]), {
			fetcher,
			now,
			force: true
		});

		expect(result.results[0].ok).toBe(false);
		expect(result.cache.sources.bom.error).toBeTruthy();
		expect(result.cache.items).toHaveLength(1);
	});

	it('aceita um feed válido sem itens como sucesso', async () => {
		const empty =
			'<?xml version="1.0"?><rss version="2.0"><channel><title>Vazio</title></channel></rss>';
		const fetcher: Fetcher = async () => new Response(empty, { status: 200 });

		const result = await refreshFeed(hub([source()]), cache(), { fetcher, now, force: true });

		expect(result.results[0]).toMatchObject({ ok: true, count: 0 });
		expect(result.cache.sources.bom.error).toBeNull();
	});

	it('continua aceitando um feed normal', async () => {
		const rss = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item><title>Novo</title><link>https://bom.test/novo</link><guid>novo-1</guid></item>
</channel></rss>`;
		const fetcher: Fetcher = async () => new Response(rss, { status: 200 });

		const result = await refreshFeed(hub([source()]), cache([previous]), {
			fetcher,
			now,
			force: true
		});

		expect(result.results[0]).toMatchObject({ ok: true, count: 1 });
		expect(result.cache.items.map((item) => item.title)).toEqual(['Novo']);
	});
});
