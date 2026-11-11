import { describe, expect, it } from 'vitest';
import { normalizeSourceOrders, sortFeedSourcesForDisplay } from './order';
import type { FeedSource } from '../types';

function source(id: string, overrides: Partial<FeedSource> = {}): FeedSource {
	return {
		id,
		type: 'rss',
		name: id,
		target: `https://example.com/${id}.xml`,
		categoryId: 'jogos',
		intervalMinutes: 30,
		enabled: true,
		include: [],
		exclude: [],
		matchMode: 'any',
		...overrides
	};
}

const categories = [
	{ id: 'jogos', order: 1 },
	{ id: 'trabalho', order: 2 }
];

describe('normalizeSourceOrders por categoria', () => {
	it('numera cada categoria de 1..n sem misturar índices globais', () => {
		const sources = [
			source('j1', { order: 1 }),
			source('t1', { categoryId: 'trabalho' }),
			source('j2', { order: 5 }),
			source('t2', { categoryId: 'trabalho', order: 3 })
		];

		const orders = normalizeSourceOrders(sources).map((entry) => ({
			id: entry.id,
			order: entry.order
		}));

		expect(orders).toEqual([
			{ id: 'j1', order: 1 },
			{ id: 't1', order: 1 },
			{ id: 'j2', order: 2 },
			{ id: 't2', order: 2 }
		]);
	});

	it('preserva a ordem visual atual dentro da categoria', () => {
		const sources = [source('b', { order: 2 }), source('a', { order: 1 }), source('c')];

		const normalized = normalizeSourceOrders(sources);

		// Visual atual: sem order (0) primeiro, depois 1 e 2 → c, a, b.
		expect(normalized.map((entry) => entry.id)).toEqual(['b', 'a', 'c']);
		expect(normalized.map((entry) => entry.order)).toEqual([3, 2, 1]);
	});

	it('não muta as fontes originais', () => {
		const sources = [source('a')];
		normalizeSourceOrders(sources);
		expect(sources[0].order).toBeUndefined();
	});
});

describe('sortFeedSourcesForDisplay', () => {
	it('agrupa por categoria e ordena dentro de cada uma', () => {
		const sources = [
			source('t2', { categoryId: 'trabalho', order: 2 }),
			source('j2', { order: 2 }),
			source('t1', { categoryId: 'trabalho', order: 1 }),
			source('j1', { order: 1 })
		];

		expect(sortFeedSourcesForDisplay(sources, categories).map((entry) => entry.id)).toEqual([
			'j1',
			'j2',
			't1',
			't2'
		]);
	});

	it('mantém no fim fontes de categoria desconhecida', () => {
		const sources = [source('x', { categoryId: 'fantasma', order: 1 }), source('j1', { order: 2 })];

		expect(sortFeedSourcesForDisplay(sources, categories).map((entry) => entry.id)).toEqual([
			'j1',
			'x'
		]);
	});
});
