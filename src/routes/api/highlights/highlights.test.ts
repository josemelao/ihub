import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonFileStorage } from '#lib/storage/json-file';
import type { POST as HighlightsPost } from './+server';

let dir: string;
let storage: JsonFileStorage;
let post: typeof HighlightsPost;

function event(body: unknown): Parameters<typeof post>[0] {
	return {
		request: new Request('http://127.0.0.1/api/highlights', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	} as unknown as Parameters<typeof post>[0];
}

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'ihub-hl-api-'));
	process.env.HUB_DATA_DIR = dir;
	storage = new JsonFileStorage(dir);
	({ POST: post } = await import('./+server'));
});

beforeEach(async () => {
	await storage.saveHighlights({ version: 1, highlights: [] });
	await storage.saveFeedCache({
		version: 1,
		updatedAt: '',
		sources: {},
		items: [
			{
				id: 'abc',
				sourceId: 's',
				title: 'Post',
				summary: '',
				url: 'https://e.com/a',
				publishedAt: '',
				thumbnail: null
			}
		]
	} as never);
});

afterAll(async () => {
	delete process.env.HUB_DATA_DIR;
	await rm(dir, { recursive: true, force: true });
});

describe('POST /api/highlights', () => {
	it('salva, atualiza e apaga um destaque', async () => {
		const save = await post(
			event({ action: 'save', itemId: 'abc', quote: 'trecho', color: 'blue' })
		);
		expect(save.status).toBe(200);
		const saved = (await save.json()) as {
			highlights: { highlights: { id: string; itemTitle: string }[] };
		};
		expect(saved.highlights.highlights[0].itemTitle).toBe('Post');
		const id = saved.highlights.highlights[0].id;

		const update = await post(event({ action: 'update', id, note: 'nota' }));
		expect(update.status).toBe(200);

		const del = await post(event({ action: 'delete', id }));
		expect(del.status).toBe(200);
		expect((await storage.loadHighlights()).highlights).toEqual([]);
	});

	it('rejeita quote vazia e item desconhecido', async () => {
		expect((await post(event({ action: 'save', itemId: 'abc', quote: '  ' }))).status).toBe(400);
		expect((await post(event({ action: 'save', itemId: 'x', quote: 'oi' }))).status).toBe(404);
	});

	it('404 ao atualizar id inexistente', async () => {
		expect((await post(event({ action: 'update', id: 'hl-x', note: 'n' }))).status).toBe(404);
	});
});
