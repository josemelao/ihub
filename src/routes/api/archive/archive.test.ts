import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('#lib/archive/service', async (importOriginal) => {
	const actual = await importOriginal<typeof import('#lib/archive/service')>();
	return {
		...actual,
		enqueueArchive: vi.fn(async () => ({
			id: 'abc',
			status: 'pending',
			title: 'Post',
			url: 'https://e.com/a',
			bytes: 0,
			assets: 0,
			createdAt: '2026-01-01T00:00:00.000Z',
			updatedAt: '2026-01-01T00:00:00.000Z'
		}))
	};
});

import { JsonFileStorage } from '#lib/storage/json-file';
import { enqueueArchive } from '#lib/archive/service';
import type { GET as ArchiveGet, POST as ArchivePost } from './+server';

let dir: string;
let storage: JsonFileStorage;
let archiveGet: typeof ArchiveGet;
let archivePost: typeof ArchivePost;

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'ihub-archive-api-'));
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
	await storage.saveState({
		version: 1,
		read: {},
		saved: ['abc'],
		savedItems: {
			abc: {
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
			}
		}
	} as never);
	({ GET: archiveGet, POST: archivePost } = await import('./+server'));
});

beforeEach(async () => {
	await storage.saveArchiveIndex({ version: 1, entries: {} });
	vi.mocked(enqueueArchive).mockClear();
});

afterAll(async () => {
	delete process.env.HUB_DATA_DIR;
	await rm(dir, { recursive: true, force: true });
});

function event(body: unknown): Parameters<typeof archivePost>[0] {
	return {
		request: new Request('http://127.0.0.1/api/archive', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	} as unknown as Parameters<typeof archivePost>[0];
}

describe('API do arquivo', () => {
	it('lista, arquiva item salvo e apaga', async () => {
		const list = await archiveGet({} as never);
		expect((await list.json()).entries).toEqual([]);

		const archive = await archivePost(event({ action: 'archive', itemId: 'abc' }));
		expect(archive.status).toBe(202);
		expect(vi.mocked(enqueueArchive)).toHaveBeenCalled();

		await storage.saveArchiveIndex({
			version: 1,
			entries: {
				abc: {
					id: 'abc',
					status: 'ready',
					title: 'Post',
					url: 'https://e.com/a',
					bytes: 10,
					assets: 1,
					createdAt: '2026-01-01T00:00:00.000Z',
					updatedAt: '2026-01-01T00:00:00.000Z'
				}
			}
		});

		const del = await archivePost(event({ action: 'delete', itemId: 'abc' }));
		expect(del.status).toBe(200);
		expect((await storage.loadArchiveIndex()).entries.abc).toBeUndefined();
	});

	it('recusa item não salvo com 409', async () => {
		expect((await archivePost(event({ action: 'archive', itemId: 'x' }))).status).toBe(409);
	});

	it('400 para payload inválido', async () => {
		expect((await archivePost(event({}))).status).toBe(400);
	});
});
