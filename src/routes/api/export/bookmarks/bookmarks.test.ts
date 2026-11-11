import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EMPTY_HUB } from '#lib/defaults';
import { parseBookmarksHtml } from '#lib/import/bookmarks';
import { JsonFileStorage } from '#lib/storage/json-file';
import type { RequestHandler } from './$types';

let dir: string;
let GET: RequestHandler;

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'meu-hub-bookmarks-'));
	process.env.HUB_DATA_DIR = dir;

	const hub = structuredClone(EMPTY_HUB);
	hub.categories = [{ id: 'jogos', name: 'Jogos', color: '#8AA4FF', order: 1 }];
	hub.items = [
		{
			id: 'link',
			type: 'link',
			name: 'Link',
			url: 'https://example.com/link',
			categoryId: 'jogos',
			tags: [],
			pinned: false,
			order: 1
		}
	];
	await new JsonFileStorage(dir).saveHub(hub);

	({ GET } = await import('./+server'));
});

afterAll(async () => {
	delete process.env.HUB_DATA_DIR;
	await rm(dir, { recursive: true, force: true });
});

describe('GET /api/export/bookmarks', () => {
	it('exports links as a Netscape bookmarks attachment', async () => {
		const response = await GET({} as Parameters<RequestHandler>[0]);

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('text/html');
		expect(response.headers.get('content-disposition')).toContain('ihub-bookmarks.html');

		const { bookmarks } = parseBookmarksHtml(await response.text());
		expect(bookmarks).toEqual([
			{ title: 'Link', url: 'https://example.com/link', folderPath: ['Jogos'] }
		]);
	});
});
