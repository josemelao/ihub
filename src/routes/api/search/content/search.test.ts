import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resetContentIndex } from '#lib/reader/content-index';
import { JsonFileStorage } from '#lib/storage/json-file';
import type { GET } from './+server';

let dir: string;
let storage: JsonFileStorage;
let get: typeof GET;

function event(query: string): Parameters<typeof get>[0] {
	return {
		url: new URL(`http://127.0.0.1/api/search/content${query}`)
	} as unknown as Parameters<typeof get>[0];
}

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'ihub-search-api-'));
	process.env.HUB_DATA_DIR = dir;
	storage = new JsonFileStorage(dir);
	({ GET: get } = await import('./+server'));
});

beforeEach(async () => {
	resetContentIndex();
	await storage.saveState({
		version: 1,
		read: {},
		saved: ['a'],
		savedItems: {
			a: {
				item: {
					id: 'a',
					sourceId: 's',
					title: 'Patch 1.2',
					summary: '',
					url: 'https://e.com/a',
					publishedAt: '2026-01-01T00:00:00.000Z',
					thumbnail: null
				},
				sourceId: 's',
				sourceName: 'Fonte E2E',
				savedAt: '2026-01-02T00:00:00.000Z'
			}
		}
	});
	await storage.saveArticle({
		id: 'a',
		url: 'https://e.com/a',
		finalUrl: 'https://e.com/a',
		title: 'Patch 1.2',
		byline: '',
		siteName: 'Fonte E2E',
		excerpt: '',
		publishedAt: '2026-01-01T00:00:00.000Z',
		fetchedAt: '2026-01-02T00:00:00.000Z',
		length: 60,
		html: '<p>O flamethrower foi ajustado no patch.</p>',
		text: 'O flamethrower foi ajustado no patch.'
	});
	await storage.saveHighlights({ version: 1, highlights: [] });
});

afterAll(async () => {
	delete process.env.HUB_DATA_DIR;
	await rm(dir, { recursive: true, force: true });
});

describe('GET /api/search/content', () => {
	it('rejeita busca com menos de dois caracteres', async () => {
		const response = await get(event('?q=a'));
		expect(response.status).toBe(400);
	});

	it('encontra o texto do salvo e devolve cobertura', async () => {
		const response = await get(event('?q=flamethrower'));
		expect(response.status).toBe(200);

		const body = (await response.json()) as {
			groups: { itemId: string; matches: { kind: string }[] }[];
			coverage: { saved: number; savedWithText: number };
		};
		expect(body.groups[0].itemId).toBe('a');
		expect(body.groups[0].matches[0].kind).toBe('text');
		expect(body.coverage).toEqual({ saved: 1, savedWithText: 1 });
	});

	it('devolve destaque de post não salvo em outside', async () => {
		await storage.saveHighlights({
			version: 1,
			highlights: [
				{
					id: 'hl-1',
					itemId: 'z',
					itemTitle: 'Guia de builds',
					itemUrl: 'https://e.com/z',
					quote: 'a build de ogryn escala',
					color: 'blue',
					occurrence: 0,
					createdAt: '2026-01-01T00:00:00.000Z',
					updatedAt: '2026-01-01T00:00:00.000Z'
				}
			]
		});

		const response = await get(event('?q=ogryn'));
		const body = (await response.json()) as {
			groups: unknown[];
			outside: { itemId: string }[];
		};
		expect(body.groups).toHaveLength(0);
		expect(body.outside[0].itemId).toBe('z');
	});

	it('respeita o limite informado', async () => {
		const response = await get(event('?q=flamethrower&limit=0'));
		const body = (await response.json()) as { groups: unknown[]; hasMore: boolean };
		expect(body.groups).toHaveLength(1);
		expect(body.hasMore).toBe(false);
	});
});
