import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EMPTY_HUB } from '#lib/defaults';
import { JsonFileStorage } from '#lib/storage/json-file';
import type { HubData } from '#lib/types';
import type { RequestHandler } from './$types';

let dir: string;
let storage: JsonFileStorage;
let POST: RequestHandler;

function hubWithSource(): HubData {
	const hub = structuredClone(EMPTY_HUB);
	hub.categories.push({ id: 'jogos', name: 'Jogos', color: '#8AA4FF', order: 1 });
	hub.feedSources.push({
		id: 'fonte',
		type: 'rss',
		name: 'Fonte',
		target: 'https://example.com/feed',
		categoryId: 'jogos',
		intervalMinutes: 30,
		enabled: true,
		include: [],
		exclude: [],
		matchMode: 'any'
	});
	return hub;
}

function event(body: unknown): Parameters<RequestHandler>[0] {
	return {
		request: new Request('http://127.0.0.1/api/hub', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	} as Parameters<RequestHandler>[0];
}

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'meu-hub-delete-'));
	process.env.HUB_DATA_DIR = dir;
	storage = new JsonFileStorage(dir);
	({ POST } = await import('./+server'));
});

beforeEach(async () => {
	await storage.saveHub(hubWithSource());
	await storage.saveFeedCache({
		version: 1,
		updatedAt: '2026-11-10T12:00:00Z',
		items: [
			{
				id: 'post',
				sourceId: 'fonte',
				title: 'Post',
				summary: '',
				url: 'https://example.com/post',
				publishedAt: '',
				thumbnail: null
			}
		],
		sources: { fonte: { lastFetchedAt: '', error: null, count: 1 } }
	});
});

afterAll(async () => {
	delete process.env.HUB_DATA_DIR;
	await rm(dir, { recursive: true, force: true });
});

describe('DELETE /api/hub de fonte', () => {
	it('remove itens e status do cache junto com a fonte', async () => {
		const response = await POST(event({ action: 'delete-source', id: 'fonte' }));
		expect(response.status).toBe(200);

		expect((await storage.loadHub()).feedSources).toEqual([]);
		const cache = await storage.loadFeedCache();
		expect(cache.items).toEqual([]);
		expect(cache.sources).toEqual({});
	});

	it('não remove a fonte se o cache estiver inválido', async () => {
		await writeFile(join(dir, 'feed-cache.json'), '{ quebrado', 'utf-8');

		const response = await POST(event({ action: 'delete-source', id: 'fonte' }));
		expect(response.status).toBe(400);

		const hub = await storage.loadHub();
		expect(hub.feedSources.map((source) => source.id)).toEqual(['fonte']);
	});
});
