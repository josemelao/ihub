import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonFileStorage } from '#lib/storage/json-file';
import type { POST as ReaderPost } from './+server';

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
});
