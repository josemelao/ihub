import { describe, expect, it, vi } from 'vitest';
import { getOrExtractArticle } from './service';
import type { FeedItem, ReadingArticle } from '../types';

const item: FeedItem = {
	id: 'abc',
	sourceId: 's',
	title: 'Post',
	summary: '',
	url: 'https://exemplo.com/post',
	publishedAt: '2026-01-01T00:00:00.000Z',
	thumbnail: null
};

const html = `<html><body><article><h1>Post</h1><p>${'texto '.repeat(120)}</p></article></body></html>`;

function fakeStorage(cached: ReadingArticle | null) {
	return {
		loadArticle: vi.fn(async () => cached),
		saveArticle: vi.fn(async () => undefined)
	};
}

describe('getOrExtractArticle', () => {
	it('usa o cache sem buscar de novo', async () => {
		const cached = { id: 'abc' } as ReadingArticle;
		const storage = fakeStorage(cached);
		const fetchText = vi.fn();

		expect(await getOrExtractArticle(storage, item, { fetchText })).toBe(cached);
		expect(fetchText).not.toHaveBeenCalled();
		expect(storage.saveArticle).not.toHaveBeenCalled();
	});

	it('busca, extrai, grava e devolve', async () => {
		const storage = fakeStorage(null);
		const fetchText = vi.fn(async () => ({ text: html, finalUrl: 'https://exemplo.com/post' }));

		const article = await getOrExtractArticle(storage, item, {
			fetchText,
			now: () => new Date('2026-02-02T00:00:00.000Z')
		});

		expect(article.id).toBe('abc');
		expect(article.fetchedAt).toBe('2026-02-02T00:00:00.000Z');
		expect(storage.saveArticle).toHaveBeenCalledWith(article);
	});

	it('não grava nada quando a extração falha', async () => {
		const storage = fakeStorage(null);
		const fetchText = vi.fn(async () => ({
			text: '<html><body></body></html>',
			finalUrl: 'https://e.com/'
		}));

		await expect(getOrExtractArticle(storage, item, { fetchText })).rejects.toThrow();
		expect(storage.saveArticle).not.toHaveBeenCalled();
	});
});
