import { describe, expect, it } from 'vitest';
import type { ReadingHighlight } from '../types';
import { searchContent, type ContentDoc } from './content-search';

const docs: ContentDoc[] = [
	{
		itemId: 'a',
		title: 'Patch 1.2',
		url: 'https://e.com/a',
		sourceName: 'r/Darktide',
		savedAt: '2026-01-02T00:00:00.000Z',
		publishedAt: '2026-01-01T00:00:00.000Z',
		text: 'O novo patch corrige o dano do flamethrower e ajusta a economia.'
	},
	{
		itemId: 'b',
		title: 'Hotfix',
		url: 'https://e.com/b',
		sourceName: 'Steam',
		savedAt: '2026-01-01T00:00:00.000Z',
		publishedAt: '2026-01-01T00:00:00.000Z',
		text: 'Hotfix ajusta a economia e o drop.'
	}
];

function highlight(overrides: Partial<ReadingHighlight>): ReadingHighlight {
	return {
		id: 'h1',
		itemId: 'a',
		itemTitle: 'Patch 1.2',
		itemUrl: 'https://e.com/a',
		quote: 'flamethrower continua forte',
		color: 'yellow',
		occurrence: 0,
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-03T00:00:00.000Z',
		...overrides
	};
}

describe('searchContent', () => {
	it('encontra no texto e devolve metadados do post', () => {
		const result = searchContent({
			docs,
			highlights: [],
			query: 'flamethrower',
			limit: 50,
			coverage: { saved: 2, savedWithText: 2 }
		});

		expect(result.total).toBe(1);
		expect(result.groups[0]).toMatchObject({
			itemId: 'a',
			title: 'Patch 1.2',
			sourceName: 'r/Darktide',
			saved: true
		});
		expect(result.groups[0].matches[0]).toMatchObject({
			kind: 'text',
			snippet: { match: 'flamethrower' }
		});
		expect(result.coverage).toEqual({ saved: 2, savedWithText: 2 });
	});

	it('exige todos os termos (AND)', () => {
		const result = searchContent({
			docs,
			highlights: [],
			query: 'patch drop',
			limit: 50,
			coverage: { saved: 2, savedWithText: 2 }
		});
		expect(result.total).toBe(0);
	});

	it('ordena por mais recentemente salvo', () => {
		const result = searchContent({
			docs,
			highlights: [],
			query: 'economia',
			limit: 50,
			coverage: { saved: 2, savedWithText: 2 }
		});
		expect(result.groups.map((group) => group.itemId)).toEqual(['a', 'b']);
	});

	it('ordena pela data de publicação quando pedido', () => {
		const crossed: ContentDoc[] = [
			{
				...docs[0],
				itemId: 'a',
				savedAt: '2026-01-05T00:00:00.000Z',
				publishedAt: '2026-01-01T00:00:00.000Z'
			},
			{
				...docs[1],
				itemId: 'b',
				savedAt: '2026-01-01T00:00:00.000Z',
				publishedAt: '2026-01-05T00:00:00.000Z'
			}
		];

		const saved = searchContent({
			docs: crossed,
			highlights: [],
			query: 'economia',
			limit: 50,
			sort: 'saved',
			coverage: { saved: 2, savedWithText: 2 }
		});
		const published = searchContent({
			docs: crossed,
			highlights: [],
			query: 'economia',
			limit: 50,
			sort: 'published',
			coverage: { saved: 2, savedWithText: 2 }
		});

		expect(saved.groups.map((group) => group.itemId)).toEqual(['a', 'b']);
		expect(published.groups.map((group) => group.itemId)).toEqual(['b', 'a']);
	});

	it('inclui destaque do próprio post e evita repetir o mesmo trecho', () => {
		const result = searchContent({
			docs,
			highlights: [highlight({ quote: 'dano do flamethrower' })],
			query: 'flamethrower',
			limit: 50,
			coverage: { saved: 2, savedWithText: 2 }
		});

		const matches = result.groups[0].matches;
		expect(matches).toHaveLength(1);
		expect(matches[0].kind).toBe('highlight');
	});

	it('leva destaque de post não salvo para a seção externa', () => {
		const result = searchContent({
			docs,
			highlights: [
				highlight({
					id: 'h2',
					itemId: 'z',
					itemTitle: 'Guia de builds',
					itemUrl: 'https://e.com/z',
					quote: 'a build de ogryn escala com resistência',
					note: 'testar depois'
				})
			],
			query: 'ogryn',
			limit: 50,
			coverage: { saved: 2, savedWithText: 2 }
		});

		expect(result.groups).toHaveLength(0);
		expect(result.outside).toHaveLength(1);
		expect(result.outside[0]).toMatchObject({
			itemId: 'z',
			title: 'Guia de builds',
			saved: false
		});
	});

	it('busca também na nota do destaque', () => {
		const result = searchContent({
			docs,
			highlights: [highlight({ quote: 'trecho qualquer', note: 'comparar com o patch antigo' })],
			query: 'patch antigo',
			limit: 50,
			coverage: { saved: 2, savedWithText: 2 }
		});
		expect(result.groups[0].matches[0].kind).toBe('highlight');
	});

	it('limita grupos e sinaliza que há mais', () => {
		const many = Array.from({ length: 4 }, (_, index) => ({
			...docs[0],
			itemId: `doc-${index}`,
			savedAt: `2026-01-0${index + 1}T00:00:00.000Z`
		}));
		const result = searchContent({
			docs: many,
			highlights: [],
			query: 'flamethrower',
			limit: 2,
			coverage: { saved: 4, savedWithText: 4 }
		});

		expect(result.groups).toHaveLength(2);
		expect(result.hasMore).toBe(true);
	});

	it('devolve vazio quando a busca não tem termos úteis', () => {
		const result = searchContent({
			docs,
			highlights: [],
			query: '   ',
			limit: 50,
			coverage: { saved: 2, savedWithText: 2 }
		});
		expect(result).toMatchObject({ total: 0, groups: [], outside: [], hasMore: false });
	});
});
