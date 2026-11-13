import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HubState, ReadingArticle } from '../types';
import { getSavedContentIndex, invalidateContentIndex, resetContentIndex } from './content-index';

function stateWith(saved: string[]): HubState {
	return {
		version: 1,
		read: {},
		saved,
		savedItems: Object.fromEntries(
			saved.map((id) => [
				id,
				{
					item: {
						id,
						sourceId: 's',
						title: `Título ${id}`,
						summary: '',
						url: `https://e.com/${id}`,
						publishedAt: '2026-01-01T00:00:00.000Z',
						thumbnail: null
					},
					sourceId: 's',
					sourceName: 'Fonte',
					savedAt: '2026-01-02T00:00:00.000Z'
				}
			])
		)
	};
}

function article(id: string, text: string): ReadingArticle {
	return {
		id,
		url: `https://e.com/${id}`,
		finalUrl: `https://e.com/${id}`,
		title: `Título ${id}`,
		byline: '',
		siteName: 'Fonte',
		excerpt: '',
		publishedAt: '',
		fetchedAt: '2026-01-01T00:00:00.000Z',
		length: text.length,
		html: `<p>${text}</p>`,
		text
	};
}

function fakeStorage(saved: string[], articles: Record<string, ReadingArticle | Error>) {
	const loadArticle = vi.fn(async (id: string) => {
		const value = articles[id];
		if (value instanceof Error) throw value;
		return value ?? null;
	});
	return {
		loadState: vi.fn(async () => stateWith(saved)),
		listArticleIds: vi.fn(async () => Object.keys(articles)),
		loadArticle
	};
}

beforeEach(() => resetContentIndex());

describe('índice de conteúdo dos salvos', () => {
	it('monta documentos dos salvos com texto e calcula a cobertura', async () => {
		const storage = fakeStorage(['a', 'b'], {
			a: article('a', '  Texto   com\nquebras  ')
		});

		const index = await getSavedContentIndex(storage);

		expect(index.savedCount).toBe(2);
		expect(index.savedWithText).toBe(1);
		expect(index.docs).toHaveLength(2);
		expect(index.docs.find((doc) => doc.itemId === 'a')?.text).toBe('Texto com quebras');
		expect(index.docs.find((doc) => doc.itemId === 'b')?.text).toBe('');
		expect(index.docs[0]).toMatchObject({
			title: 'Título a',
			sourceName: 'Fonte',
			url: 'https://e.com/a',
			publishedAt: '2026-01-01T00:00:00.000Z'
		});
	});

	it('reaproveita o cache enquanto a assinatura não muda', async () => {
		const storage = fakeStorage(['a'], { a: article('a', 'texto') });

		await getSavedContentIndex(storage);
		await getSavedContentIndex(storage);

		expect(storage.loadArticle).toHaveBeenCalledTimes(1);
	});

	it('recarrega depois de invalidar', async () => {
		const storage = fakeStorage(['a'], { a: article('a', 'texto') });

		await getSavedContentIndex(storage);
		invalidateContentIndex();
		await getSavedContentIndex(storage);

		expect(storage.loadArticle).toHaveBeenCalledTimes(2);
	});

	it('recarrega quando o conjunto de salvos muda', async () => {
		const storage = fakeStorage(['a'], { a: article('a', 'texto') });
		await getSavedContentIndex(storage);

		storage.loadState.mockResolvedValueOnce(stateWith(['a', 'b']));
		await getSavedContentIndex(storage);

		expect(storage.loadArticle).toHaveBeenCalled();
	});

	it('trunca o texto indexado em 50 mil caracteres', async () => {
		const storage = fakeStorage(['a'], { a: article('a', 'x'.repeat(60_000)) });

		const index = await getSavedContentIndex(storage);

		expect(index.docs[0].text).toHaveLength(50_000);
	});

	it('ignora artigo corrompido sem derrubar a busca', async () => {
		const storage = fakeStorage(['a'], { a: new Error('corrompido') });

		const index = await getSavedContentIndex(storage);

		expect(index.savedWithText).toBe(0);
		expect(index.docs[0].text).toBe('');
	});
});
