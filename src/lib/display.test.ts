import { describe, it, expect } from 'vitest';
import { initials, tint, categoryItemCounts, relativeTime } from './display';
import type { HubData } from './types';

describe('initials', () => {
	it('usa as iniciais das duas primeiras palavras', () => {
		expect(initials('Abrir Darktide')).toBe('AD');
	});
	it('usa duas letras quando há uma palavra só', () => {
		expect(initials('Steam')).toBe('ST');
	});
	it('ignora espaços extras', () => {
		expect(initials('  Wiki   da comunidade ')).toBe('WD');
	});
});

describe('tint', () => {
	it('converte hex para rgba com transparência', () => {
		expect(tint('#8AA4FF', 0.15)).toBe('rgba(138, 164, 255, 0.15)');
	});
});

describe('relativeTime', () => {
	const now = new Date('2026-11-09T12:00:00.000Z').getTime();

	it('mostra minutos', () => {
		expect(relativeTime('2026-11-09T11:35:00.000Z', now)).toBe('há 25 min');
	});

	it('mostra horas', () => {
		expect(relativeTime('2026-11-09T11:00:00.000Z', now)).toBe('há 1 h');
	});

	it('mostra ontem', () => {
		expect(relativeTime('2026-11-08T10:00:00.000Z', now)).toBe('ontem');
	});

	it('mostra dias', () => {
		expect(relativeTime('2026-11-06T12:00:00.000Z', now)).toBe('há 3 dias');
	});

	it('lida com data ausente', () => {
		expect(relativeTime('', now)).toBe('sem data');
	});
});

describe('categoryItemCounts', () => {
	it('conta itens por categoria', () => {
		const hub = {
			version: 1,
			settings: { accent: '#8AA4FF' },
			categories: [
				{ id: 'a', name: 'A', color: '#fff', order: 1 },
				{ id: 'b', name: 'B', color: '#fff', order: 2 }
			],
			items: [
				{
					id: '1',
					type: 'link',
					name: '1',
					url: 'https://a.com',
					categoryId: 'a',
					tags: [],
					pinned: false,
					order: 0
				},
				{
					id: '2',
					type: 'link',
					name: '2',
					url: 'https://b.com',
					categoryId: 'b',
					tags: [],
					pinned: false,
					order: 0
				},
				{
					id: '3',
					type: 'link',
					name: '3',
					url: 'https://c.com',
					categoryId: 'a',
					tags: [],
					pinned: false,
					order: 0
				}
			],
			groups: [],
			feedSources: [],
			savedFilters: []
		} as HubData;

		expect(categoryItemCounts(hub)).toEqual({ a: 2, b: 1 });
	});
});
