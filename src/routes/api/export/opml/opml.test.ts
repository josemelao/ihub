import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EMPTY_HUB } from '#lib/defaults';
import { parseOpml } from '#lib/import/opml';
import { JsonFileStorage } from '#lib/storage/json-file';
import type { RequestHandler } from './$types';

let dir: string;
let GET: RequestHandler;

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'meu-hub-opml-'));
	process.env.HUB_DATA_DIR = dir;

	const hub = structuredClone(EMPTY_HUB);
	hub.categories = [{ id: 'jogos', name: 'Jogos', color: '#8AA4FF', order: 1 }];
	hub.feedSources = [
		{
			id: 'feed',
			type: 'rss',
			name: 'Feed',
			target: 'https://example.com/feed.xml',
			categoryId: 'jogos',
			intervalMinutes: 30,
			enabled: true,
			include: [],
			exclude: [],
			matchMode: 'any'
		}
	];
	await new JsonFileStorage(dir).saveHub(hub);

	({ GET } = await import('./+server'));
});

afterAll(async () => {
	delete process.env.HUB_DATA_DIR;
	await rm(dir, { recursive: true, force: true });
});

describe('GET /api/export/opml', () => {
	it('exports feed sources as an OPML attachment', async () => {
		const response = await GET({} as Parameters<RequestHandler>[0]);

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('application/xml');
		expect(response.headers.get('content-disposition')).toContain('ihub-feeds.opml');

		const { sources } = parseOpml(await response.text());
		expect(sources).toEqual([
			{
				name: 'Feed',
				feedUrl: 'https://example.com/feed.xml',
				folderPath: ['Jogos']
			}
		]);
	});
});
