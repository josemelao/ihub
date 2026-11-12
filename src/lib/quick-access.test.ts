import { describe, expect, it } from 'vitest';
import { moveQuickAccess, quickAccessItems } from './quick-access';
import type { HubData, HubItem } from './types';

const link = (id: string, overrides: Partial<HubItem> = {}): HubItem =>
	({
		id,
		type: 'link',
		name: id,
		url: `https://exemplo.test/${id}`,
		categoryId: 'jogos',
		tags: [],
		pinned: true,
		order: 1,
		...overrides
	}) as HubItem;

const hub = (items: HubItem[], settings: HubData['settings'] = { accent: '#8AA4FF' }): HubData => ({
	version: 2,
	settings,
	categories: [{ id: 'jogos', name: 'Jogos', color: '#8AA4FF', order: 1 }],
	groups: [],
	items,
	feedSources: [],
	savedFilters: []
});

describe('quickAccessItems', () => {
	it('inclui só itens fixados', () => {
		const result = quickAccessItems(hub([link('a'), link('b', { pinned: false })]));

		expect(result.map((item) => item.id)).toEqual(['a']);
	});

	it('respeita quickAccessOrder e deixa o resto no fim', () => {
		const data = hub([link('a'), link('b'), link('c')], {
			accent: '#8AA4FF',
			quickAccessOrder: ['c', 'a']
		});

		expect(quickAccessItems(data).map((item) => item.id)).toEqual(['c', 'a', 'b']);
	});

	it('usa order como desempate', () => {
		const data = hub([link('b', { order: 2 }), link('a', { order: 1 })]);

		expect(quickAccessItems(data).map((item) => item.id)).toEqual(['a', 'b']);
	});

	it('respeita o limite configurado', () => {
		const data = hub([link('a'), link('b'), link('c')], {
			accent: '#8AA4FF',
			quickAccessLimit: 2
		});

		expect(quickAccessItems(data)).toHaveLength(2);
	});

	it('aceita limite explícito', () => {
		const data = hub([link('a'), link('b'), link('c')]);

		expect(quickAccessItems(data, 1)).toHaveLength(1);
	});
});

describe('moveQuickAccess', () => {
	it('move para cima e para baixo', () => {
		expect(moveQuickAccess(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
		expect(moveQuickAccess(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b']);
	});

	it('ignora movimentos fora dos limites', () => {
		expect(moveQuickAccess(['a', 'b'], 'a', -1)).toEqual(['a', 'b']);
		expect(moveQuickAccess(['a', 'b'], 'b', 1)).toEqual(['a', 'b']);
	});

	it('ignora id desconhecido', () => {
		expect(moveQuickAccess(['a', 'b'], 'z', 1)).toEqual(['a', 'b']);
	});
});
