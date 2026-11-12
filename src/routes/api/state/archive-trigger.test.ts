import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('#lib/archive/service', () => ({
	enqueueArchive: vi.fn(async () => ({})),
	deleteArchive: vi.fn(async () => true)
}));

import { JsonFileStorage } from '#lib/storage/json-file';
import { enqueueArchive, deleteArchive } from '#lib/archive/service';
import type { POST as StatePost } from './+server';

let dir: string;
let storage: JsonFileStorage;
let post: typeof StatePost;

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'ihub-state-archive-'));
	process.env.HUB_DATA_DIR = dir;
	storage = new JsonFileStorage(dir);
	await storage.saveHub({
		version: 2,
		settings: { accent: '#8AA4FF' },
		categories: [{ id: 'c', name: 'C', color: '#8AA4FF', order: 1 }],
		groups: [],
		items: [],
		feedSources: [
			{
				id: 's',
				type: 'rss',
				name: 'S',
				target: 'https://e.com/f',
				categoryId: 'c',
				intervalMinutes: 30,
				enabled: true,
				include: [],
				exclude: [],
				matchMode: 'any'
			}
		],
		savedFilters: []
	} as never);
	({ POST: post } = await import('./+server'));
});

afterAll(async () => {
	delete process.env.HUB_DATA_DIR;
	await rm(dir, { recursive: true, force: true });
});

function event(body: unknown): Parameters<typeof post>[0] {
	return {
		request: new Request('http://127.0.0.1/api/state', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	} as unknown as Parameters<typeof post>[0];
}

const snapshot = {
	item: {
		id: 'abc',
		sourceId: 's',
		title: 'Post',
		summary: '',
		url: 'https://e.com/a',
		publishedAt: '',
		thumbnail: null
	},
	sourceId: 's',
	sourceName: 'S',
	savedAt: '2026-01-01T00:00:00.000Z'
};

describe('/api/state dispara arquivamento', () => {
	it('enfileira ao salvar e apaga ao dessalvar', async () => {
		expect((await post(event({ action: 'save', id: 'abc', snapshot }))).status).toBe(200);
		await vi.waitFor(() =>
			expect(vi.mocked(enqueueArchive)).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ sourceType: 'rss' })
			)
		);

		expect((await post(event({ action: 'unsave', id: 'abc' }))).status).toBe(200);
		await vi.waitFor(() =>
			expect(vi.mocked(deleteArchive)).toHaveBeenCalledWith(expect.anything(), 'abc')
		);
	});
});
