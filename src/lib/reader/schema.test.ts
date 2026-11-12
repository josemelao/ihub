import { describe, expect, it } from 'vitest';
import { HubValidationError, parseHighlights, parseReadingArticle } from '../schema';

const article = {
	id: 'abc123',
	url: 'https://exemplo.com/a',
	finalUrl: 'https://exemplo.com/a',
	title: 'Título',
	byline: '',
	siteName: 'Exemplo',
	excerpt: '',
	publishedAt: '2026-01-01T00:00:00.000Z',
	fetchedAt: '2026-01-02T00:00:00.000Z',
	length: 2,
	html: '<p>oi</p>',
	text: 'oi'
};

const highlight = {
	id: 'hl-1',
	itemId: 'abc123',
	itemTitle: 'Título',
	itemUrl: 'https://exemplo.com/a',
	quote: 'trecho',
	color: 'yellow' as const,
	occurrence: 0,
	createdAt: '2026-01-02T00:00:00.000Z',
	updatedAt: '2026-01-02T00:00:00.000Z'
};

describe('schema de leitura', () => {
	it('aceita artigo válido e rejeita id inseguro', () => {
		expect(parseReadingArticle(article).title).toBe('Título');
		expect(() => parseReadingArticle({ ...article, id: '../x' })).toThrow(HubValidationError);
	});

	it('rejeita URL de artigo que não é http(s)', () => {
		expect(() => parseReadingArticle({ ...article, finalUrl: 'javascript:alert(1)' })).toThrow(
			HubValidationError
		);
	});

	it('aceita highlights válidos e preenche occurrence ausente', () => {
		const parsed = parseHighlights({
			version: 1,
			highlights: [{ ...highlight, occurrence: undefined }]
		});

		expect(parsed.highlights[0].occurrence).toBe(0);
	});

	it('rejeita cor desconhecida e quote vazia', () => {
		expect(() =>
			parseHighlights({ version: 1, highlights: [{ ...highlight, color: 'roxo' }] })
		).toThrow(HubValidationError);
		expect(() =>
			parseHighlights({ version: 1, highlights: [{ ...highlight, quote: '   ' }] })
		).toThrow(HubValidationError);
	});

	it('rejeita ids duplicados', () => {
		expect(() => parseHighlights({ version: 1, highlights: [highlight, highlight] })).toThrow(
			HubValidationError
		);
	});
});
