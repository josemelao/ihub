import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { JsonFileStorage } from '#lib/storage/json-file';
import type { GET } from './+server';

let dir: string;
let storage: JsonFileStorage;
let get: typeof GET;

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'ihub-markdown-api-'));
	process.env.HUB_DATA_DIR = dir;
	storage = new JsonFileStorage(dir);

	await storage.saveHub({
		version: 2,
		settings: { accent: '#8AA4FF' },
		categories: [{ id: 'jogos', name: 'Jogos', color: '#8AA4FF', order: 1 }],
		groups: [],
		items: [],
		feedSources: [
			{
				id: 's',
				type: 'rss',
				name: 'Fonte E2E',
				target: 'https://e.com/f',
				categoryId: 'jogos',
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
					title: 'Post de teste',
					summary: 'Resumo',
					url: 'https://e.com/a',
					publishedAt: '2026-01-01T00:00:00.000Z',
					thumbnail: null
				},
				sourceId: 's',
				sourceName: 'Fonte E2E',
				categoryId: 'jogos',
				categoryName: 'Jogos',
				savedAt: '2026-02-01T00:00:00.000Z'
			}
		}
	} as never);
	await storage.saveFeedCache({ version: 1, updatedAt: '', sources: {}, items: [] } as never);
	await storage.saveHighlights({
		version: 1,
		highlights: [
			{
				id: 'hl-1',
				itemId: 'abc',
				itemTitle: 'Post de teste',
				itemUrl: 'https://e.com/a',
				quote: 'trecho exportado',
				note: 'nota exportada',
				color: 'yellow',
				occurrence: 0,
				createdAt: '2026-03-01T00:00:00.000Z',
				updatedAt: '2026-03-01T00:00:00.000Z'
			}
		]
	});
	await storage.saveArchiveIndex({ version: 1, entries: {} });

	({ GET: get } = await import('./+server'));
});

afterAll(async () => {
	delete process.env.HUB_DATA_DIR;
	await rm(dir, { recursive: true, force: true });
});

describe('GET /api/export/markdown', () => {
	it('devolve um ZIP com index e um Markdown por item', async () => {
		const response = await get({
			url: new URL('http://127.0.0.1:5757/api/export/markdown')
		} as never);

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('application/zip');
		expect(response.headers.get('content-disposition')).toContain('meu-hub-export-');

		const zip = unzipSync(new Uint8Array(await response.arrayBuffer()));
		const names = Object.keys(zip);
		expect(names).toContain('index.md');

		const note = names.find((name) => name.endsWith('.md') && name !== 'index.md')!;
		const content = strFromU8(zip[note]);
		expect(content).toContain('url: "https://e.com/a"');
		expect(content).toContain('trecho exportado');
		expect(content).toContain('nota exportada');
		expect(strFromU8(zip['index.md'])).toContain(note);
	});
});
