import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPublicText, type FetchTextOptions } from '../net/safe-fetch';
import { refreshFeed, type Fetcher } from './refresh';
import type { FeedSource, HubData } from '../types';

vi.mock('../net/safe-fetch', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../net/safe-fetch')>();
	return { ...actual, fetchPublicText: vi.fn() };
});

const fetchTextMock = vi.mocked(fetchPublicText);

beforeEach(() => {
	fetchTextMock.mockReset();
	fetchTextMock.mockImplementation(async (target: string, options: FetchTextOptions = {}) => {
		const fetcher = options.fetcher ?? fetch;
		const response = await fetcher(target);
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		return { text: await response.text(), finalUrl: target };
	});
});

const rss = (id: string) => `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item><title>Post ${id}</title><link>https://fonte.test/${id}</link><guid>${id}</guid></item>
</channel></rss>`;

const source = (index: number): FeedSource => ({
	id: `fonte-${index}`,
	type: 'rss',
	name: `Fonte ${index}`,
	target: `https://fonte.test/${index}.xml`,
	categoryId: 'jogos',
	intervalMinutes: 30,
	enabled: true,
	include: [],
	exclude: [],
	matchMode: 'any'
});

const hub = (sources: FeedSource[]): HubData => ({
	version: 2,
	settings: { accent: '#8AA4FF' },
	categories: [{ id: 'jogos', name: 'Jogos', color: '#8AA4FF', order: 1 }],
	groups: [],
	items: [],
	feedSources: sources,
	savedFilters: []
});

const emptyCache = () => ({ version: 1, updatedAt: '', items: [], sources: {} });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function slowFetcher(delayMs: number) {
	let running = 0;
	let peak = 0;

	const fetcher: Fetcher = async (input) => {
		running += 1;
		peak = Math.max(peak, running);
		await sleep(delayMs);
		running -= 1;
		const id = String(input).split('/').pop()?.replace('.xml', '') ?? 'x';
		return new Response(rss(id), { status: 200 });
	};

	return { fetcher, peak: () => peak };
}

describe('refreshFeed concorrente', () => {
	it('atualiza 10 fontes em paralelo limitado', async () => {
		const sources = Array.from({ length: 10 }, (_, index) => source(index));
		const { fetcher, peak } = slowFetcher(100);

		const started = Date.now();
		const result = await refreshFeed(hub(sources), emptyCache(), {
			fetcher,
			force: true,
			now: () => new Date()
		});
		const elapsed = Date.now() - started;

		expect(result.results).toHaveLength(10);
		expect(result.results.every((entry) => entry.ok)).toBe(true);
		expect(peak()).toBeLessThanOrEqual(4);
		expect(elapsed).toBeLessThan(1000);
	});

	it('mantém os resultados na ordem das fontes', async () => {
		const sources = Array.from({ length: 6 }, (_, index) => source(index));
		const { fetcher } = slowFetcher(10);

		const result = await refreshFeed(hub(sources), emptyCache(), { fetcher, force: true });

		expect(result.results.map((entry) => entry.sourceId)).toEqual(sources.map((entry) => entry.id));
	});

	it('respeita um limite de concorrência menor', async () => {
		const sources = Array.from({ length: 6 }, (_, index) => source(index));
		const { fetcher, peak } = slowFetcher(20);

		await refreshFeed(hub(sources), emptyCache(), {
			fetcher,
			force: true,
			concurrency: 2
		});

		expect(peak()).toBeLessThanOrEqual(2);
	});

	it('isola o erro de uma fonte sem derrubar as outras', async () => {
		const sources = Array.from({ length: 5 }, (_, index) => source(index));
		const base = slowFetcher(10);
		const fetcher: Fetcher = async (input, init) => {
			if (String(input).includes('/3.xml')) throw new Error('HTTP 500');
			return base.fetcher(input, init);
		};

		const result = await refreshFeed(hub(sources), emptyCache(), { fetcher, force: true });

		expect(result.results.filter((entry) => entry.ok)).toHaveLength(4);
		expect(result.results.find((entry) => entry.sourceId === 'fonte-3')?.ok).toBe(false);
	});

	it('registra a duração de cada fonte', async () => {
		const sources = [source(1), source(2)];
		const { fetcher } = slowFetcher(5);

		const result = await refreshFeed(hub(sources), emptyCache(), { fetcher, force: true });

		for (const entry of result.results) {
			expect(entry.durationMs).toBeGreaterThanOrEqual(0);
		}
	});
});
