import { describe, it, expect } from 'vitest';
import { parseHub, HubValidationError } from './schema';

const base = {
	version: 1,
	settings: { accent: '#8AA4FF' },
	categories: [{ id: 'jogos', name: 'Jogos', color: '#8AA4FF', order: 1 }],
	groups: [{ id: 'darktide', categoryId: 'jogos', name: 'Darktide', order: 1 }],
	items: [
		{
			id: 'darktide-reddit',
			type: 'link' as const,
			name: 'Subreddit r/Darktide',
			url: 'https://www.reddit.com/r/Darktide/',
			categoryId: 'jogos',
			groupId: 'darktide'
		}
	],
	feedSources: [],
	savedFilters: []
};

describe('parseHub', () => {
	it('aceita um hub válido e aplica valores padrão', () => {
		const hub = parseHub(base);
		expect(hub.items[0].pinned).toBe(false);
		expect(hub.items[0].order).toBe(0);
		expect(hub.items[0].tags).toEqual([]);
	});

	it('rejeita item que aponta para categoria inexistente com caminho legível', () => {
		const invalid = structuredClone(base);
		invalid.items[0].categoryId = 'nao-existe';

		expect(() => parseHub(invalid)).toThrow(HubValidationError);
		try {
			parseHub(invalid);
		} catch (error) {
			const issues = (error as HubValidationError).issues;
			expect(issues.some((i) => i.path.join('.') === 'items.0.categoryId')).toBe(true);
			expect(issues.some((i) => i.message.includes('categoria'))).toBe(true);
		}
	});

	it('rejeita ids de categoria duplicados', () => {
		const invalid = structuredClone(base);
		invalid.categories.push({ id: 'jogos', name: 'Outra', color: '#7DD3A8', order: 2 });

		expect(() => parseHub(invalid)).toThrow(HubValidationError);
		try {
			parseHub(invalid);
		} catch (error) {
			const issues = (error as HubValidationError).issues;
			expect(issues.some((i) => i.message.toLowerCase().includes('duplicado'))).toBe(true);
		}
	});

	it('rejeita link com URL inválida', () => {
		const invalid = structuredClone(base);
		invalid.items[0].url = 'nao-e-uma-url';

		expect(() => parseHub(invalid)).toThrow(HubValidationError);
	});
});
