import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RateLimitError, fetchPublicText } from '../net/safe-fetch';
import { refreshFeed } from './refresh';
import type { FeedCache, FeedSource, HubData } from '../types';

vi.mock('../net/safe-fetch', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../net/safe-fetch')>();
	return { ...actual, fetchPublicText: vi.fn() };
});

const fetchTextMock = vi.mocked(fetchPublicText);

const rss = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item>
    <title>Post</title>
    <link>https://www.reddit.com/r/x/comments/abc/post/</link>
    <description>texto</description>
    <pubDate>Mon, 09 Nov 2026 12:00:00 GMT</pubDate>
    <guid>post-1</guid>
  </item>
</channel></rss>`;

const reddit = (name: string): FeedSource => ({
	id: name.toLowerCase(),
	type: 'reddit',
	name,
	target: name,
	categoryId: 'jogos',
	intervalMinutes: 30,
	enabled: true,
	include: [],
	exclude: [],
	matchMode: 'any'
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

const cacheAt = (times: Record<string, string>): FeedCache => ({
	version: 1,
	updatedAt: '2026-11-01T00:00:00.000Z',
	items: [],
	sources: Object.fromEntries(
		Object.entries(times).map(([id, lastFetchedAt]) => [
			id,
			{ lastFetchedAt, error: null, count: 0 }
		])
	)
});

const now = () => new Date('2026-11-09T12:00:00.000Z');

const fetchedNames = () =>
	fetchTextMock.mock.calls.map(([target]) =>
		String(target)
			.match(/\/r\/([^/]+)\//)?.[1]
			?.toLowerCase()
	);

beforeEach(() => {
	fetchTextMock.mockReset();
	fetchTextMock.mockImplementation(async (target: string) => ({
		text: rss,
		finalUrl: String(target)
	}));
});

describe('rotação de fontes no mesmo host', () => {
	const sources = [reddit('Darktide'), reddit('Dota2'), reddit('Vermintide'), reddit('Legends')];

	it('busca uma só fonte por execução, começando pela mais atrasada', async () => {
		const cache = cacheAt({
			darktide: '2026-11-09T11:00:00.000Z',
			dota2: '2026-11-09T08:00:00.000Z',
			vermintide: '2026-11-09T10:00:00.000Z',
			legends: '2026-11-09T09:00:00.000Z'
		});

		const { cache: out } = await refreshFeed(hub(sources), cache, { now });

		expect(fetchTextMock).toHaveBeenCalledTimes(1);
		expect(fetchedNames()).toEqual(['dota2']);
		expect(out.sources.dota2.lastFetchedAt).toBe('2026-11-09T12:00:00.000Z');
		// As adiadas não podem parecer "buscadas", senão só voltam em 30 min.
		expect(out.sources.darktide.lastFetchedAt).toBe('2026-11-09T11:00:00.000Z');
		expect(out.sources.legends.lastFetchedAt).toBe('2026-11-09T09:00:00.000Z');
	});

	it('na execução seguinte pega a próxima da fila, respeitando a janela', async () => {
		const cache = cacheAt({
			darktide: '2026-11-09T11:00:00.000Z',
			dota2: '2026-11-09T08:00:00.000Z',
			vermintide: '2026-11-09T10:00:00.000Z',
			legends: '2026-11-09T09:00:00.000Z'
		});

		const first = await refreshFeed(hub(sources), cache, { now });
		const later = () => new Date('2026-11-09T12:06:00.000Z');
		const second = await refreshFeed(hub(sources), first.cache, { now: later });

		expect(fetchedNames()).toEqual(['dota2', 'legends']);
		expect(second.cache.sources.legends.lastFetchedAt).toBe('2026-11-09T12:06:00.000Z');
	});

	it('não repete o host antes da janela mínima', async () => {
		const cache = cacheAt({
			darktide: '2026-11-09T11:00:00.000Z',
			dota2: '2026-11-09T08:00:00.000Z',
			vermintide: '2026-11-09T10:00:00.000Z',
			legends: '2026-11-09T09:00:00.000Z'
		});

		const first = await refreshFeed(hub(sources), cache, { now });
		const soon = () => new Date('2026-11-09T12:01:00.000Z');
		const second = await refreshFeed(hub(sources), first.cache, { now: soon });

		expect(fetchTextMock).toHaveBeenCalledTimes(1);
		expect(second.results.every((result) => result.skipped || result.count === 0)).toBe(true);
	});

	it('não adia hosts fora da lista ritmada', async () => {
		const local: FeedSource[] = [
			{ ...reddit('A'), type: 'rss', target: 'https://blog.test/a' },
			{ ...reddit('B'), type: 'rss', target: 'https://blog.test/b' }
		];

		await refreshFeed(hub(local), cacheAt({ a: '', b: '' }), { now });

		expect(fetchTextMock).toHaveBeenCalledTimes(2);
	});

	it('uma fonte só no host não sofre adiamento', async () => {
		await refreshFeed(hub([reddit('Darktide')]), cacheAt({ darktide: '' }), { now });

		expect(fetchTextMock).toHaveBeenCalledTimes(1);
	});
});

describe('429 no refresh', () => {
	it('não grava lastFetchedAt, para tentar de novo no próximo ciclo', async () => {
		fetchTextMock.mockRejectedValue(new RateLimitError('O site limitou (429).'));

		const cache = cacheAt({ darktide: '2026-11-09T11:30:00.000Z' });
		const { cache: out, results } = await refreshFeed(hub([reddit('Darktide')]), cache, { now });

		expect(results[0].ok).toBe(false);
		expect(out.sources.darktide.error).toContain('429');
		expect(out.sources.darktide.lastFetchedAt).toBe('2026-11-09T11:30:00.000Z');
	});

	it('mantém a fonte vencida e ainda presa ao intervalo normal para erros comuns', async () => {
		fetchTextMock.mockRejectedValue(new Error('HTTP 500'));

		const cache = cacheAt({ darktide: '2026-11-09T11:30:00.000Z' });
		const { cache: out } = await refreshFeed(hub([reddit('Darktide')]), cache, { now });

		expect(out.sources.darktide.lastFetchedAt).toBe('2026-11-09T12:00:00.000Z');
	});
});
