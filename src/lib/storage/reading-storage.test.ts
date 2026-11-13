import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonFileStorage } from './json-file';
import { EMPTY_HUB } from '../defaults';
import type { HighlightsData, ReadingArticle } from '../types';

let dir: string;
let storage: JsonFileStorage;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), 'ihub-reading-'));
	storage = new JsonFileStorage(dir);
	await storage.saveHub(EMPTY_HUB);
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

const article: ReadingArticle = {
	id: 'abc',
	url: 'https://e.com/a',
	finalUrl: 'https://e.com/a',
	title: 'T',
	byline: '',
	siteName: 'E',
	excerpt: '',
	publishedAt: '',
	fetchedAt: '2026-01-01T00:00:00.000Z',
	length: 1,
	html: '<p>x</p>',
	text: 'x'
};

const highlights: HighlightsData = {
	version: 1,
	highlights: [
		{
			id: 'hl-1',
			itemId: 'abc',
			itemTitle: 'T',
			itemUrl: 'https://e.com/a',
			quote: 'x',
			color: 'yellow',
			occurrence: 0,
			createdAt: '2026-01-01T00:00:00.000Z',
			updatedAt: '2026-01-01T00:00:00.000Z'
		}
	]
};

describe('storage de leitura', () => {
	it('grava artigo e devolve na leitura', async () => {
		await storage.saveArticle(article);

		expect(await storage.loadArticle('abc')).toMatchObject({ title: 'T' });
		expect(await storage.loadArticle('outro')).toBeNull();
	});

	it('rejeita id inválido ao apagar artigo', async () => {
		await expect(storage.deleteArticle('../x')).rejects.toThrow();
	});

	it('grava, atualiza e lê destaques', async () => {
		await storage.saveHighlights(highlights);
		expect(await storage.loadHighlights()).toEqual(highlights);

		const next = await storage.updateHighlights((data) => ({
			...data,
			highlights: [...data.highlights, { ...data.highlights[0], id: 'hl-2' }]
		}));

		expect(next.highlights).toHaveLength(2);
	});

	it('inclui destaques no export', async () => {
		await storage.saveHighlights(highlights);

		expect((await storage.exportBundle()).highlights?.highlights).toHaveLength(1);
	});

	it('lista os ids de artigos gravados', async () => {
		expect(await storage.listArticleIds()).toEqual([]);

		await storage.saveArticle(article);
		await storage.saveArticle({ ...article, id: 'def' });

		expect((await storage.listArticleIds()).sort()).toEqual(['abc', 'def']);
	});

	it('importa destaques no replace e mescla por id', async () => {
		await storage.importBundle({ hub: EMPTY_HUB, highlights }, 'replace');
		expect((await storage.loadHighlights()).highlights).toHaveLength(1);

		await storage.saveHighlights({ version: 1, highlights: [] });
		await storage.importBundle({ hub: EMPTY_HUB, highlights }, 'merge');
		expect((await storage.loadHighlights()).highlights).toHaveLength(1);
	});
});
