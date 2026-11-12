import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonFileStorage } from '#lib/storage/json-file';
import { ReaderError } from '#lib/reader/extract';
import { getOrExtractArticle } from '#lib/reader/service';
import type { POST as ReaderPost } from './+server';

vi.mock('#lib/reader/service', () => ({ getOrExtractArticle: vi.fn() }));

let dir: string;
let storage: JsonFileStorage;
let readerPost: typeof ReaderPost;

function event(body: unknown): Parameters<typeof readerPost>[0] {
	return {
		request: new Request('http://127.0.0.1/api/reader', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	} as unknown as Parameters<typeof readerPost>[0];
}

const hub = (fullText: boolean) => ({
	version: 2,
	settings: { accent: '#8AA4FF' },
	categories: [{ id: 'c', name: 'C', color: '#8AA4FF', order: 1 }],
	groups: [],
	items: [],
	feedSources: [
		{
			id: 's',
			type: 'rss' as const,
			name: 'S',
			target: 'https://e.com/feed',
			categoryId: 'c',
			intervalMinutes: 30,
			enabled: true,
			fullText,
			include: [],
			exclude: [],
			matchMode: 'any' as const
		}
	],
	savedFilters: []
});

const cache = {
	version: 1,
	updatedAt: '2026-01-01T00:00:00.000Z',
	sources: {},
	items: [
		{
			id: 'abc',
			sourceId: 's',
			title: 'Post',
			summary: '',
			url: 'https://e.com/post',
			publishedAt: '2026-01-01T00:00:00.000Z',
			thumbnail: null
		}
	]
};

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'ihub-reader-api-'));
	process.env.HUB_DATA_DIR = dir;
	storage = new JsonFileStorage(dir);
	({ POST: readerPost } = await import('./+server'));
});

beforeEach(() => {
	vi.mocked(getOrExtractArticle).mockReset();
});

afterAll(async () => {
	delete process.env.HUB_DATA_DIR;
	await rm(dir, { recursive: true, force: true });
});

describe('POST /api/reader', () => {
	it('recusa payload inválido com 400', async () => {
		expect((await readerPost(event({}))).status).toBe(400);
	});

	it('devolve 404 para item fora do cache', async () => {
		await storage.saveHub(hub(true) as never);
		await storage.saveFeedCache(cache as never);

		expect((await readerPost(event({ itemId: 'nao-existe' }))).status).toBe(404);
	});

	it('devolve 409 quando o texto completo está desligado', async () => {
		await storage.saveHub(hub(false) as never);

		const response = await readerPost(event({ itemId: 'abc' }));

		expect(response.status).toBe(409);
		await expect(response.json()).resolves.toMatchObject({ code: 'full-text-off' });
	});

	it('devolve artigo cacheado mesmo com o toggle desligado', async () => {
		await storage.saveArticle({
			id: 'abc',
			url: 'https://e.com/post',
			finalUrl: 'https://e.com/post',
			title: 'Post',
			byline: '',
			siteName: '',
			excerpt: '',
			publishedAt: '',
			fetchedAt: '2026-01-01T00:00:00.000Z',
			length: 1,
			html: '<p>x</p>',
			text: 'x'
		});

		const response = await readerPost(event({ itemId: 'abc' }));

		expect(response.status).toBe(200);
	});

	it('resolve post salvo fora do cache do feed', async () => {
		await storage.saveHub(hub(false) as never);
		await storage.saveFeedCache({ ...cache, items: [] } as never);
		await storage.saveState({
			version: 1,
			read: {},
			saved: ['salvo'],
			savedItems: {
				salvo: {
					item: {
						id: 'salvo',
						sourceId: 's',
						title: 'Salvo',
						summary: '',
						url: 'https://e.com/salvo',
						publishedAt: '',
						thumbnail: null
					},
					sourceId: 's',
					sourceName: 'S',
					savedAt: '2026-01-01T00:00:00.000Z'
				}
			}
		} as never);
		await storage.saveArticle({
			id: 'salvo',
			url: 'https://e.com/salvo',
			finalUrl: 'https://e.com/salvo',
			title: 'Salvo',
			byline: '',
			siteName: '',
			excerpt: '',
			publishedAt: '',
			fetchedAt: '2026-01-01T00:00:00.000Z',
			length: 1,
			html: '<p>x</p>',
			text: 'x'
		});

		const response = await readerPost(event({ itemId: 'salvo' }));

		expect(response.status).toBe(200);
	});

	it('devolve 502 com a mensagem segura do ReaderError', async () => {
		await storage.saveHub(hub(true) as never);
		await storage.saveFeedCache(cache as never);
		await storage.deleteArticle('abc');
		vi.mocked(getOrExtractArticle).mockRejectedValueOnce(
			new ReaderError('Artigo grande demais para o cache local.', 'too-large')
		);

		const response = await readerPost(event({ itemId: 'abc' }));

		expect(response.status).toBe(502);
		await expect(response.json()).resolves.toMatchObject({
			code: 'too-large',
			error: expect.stringContaining('grande demais')
		});
	});
});
