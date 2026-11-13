import { describe, expect, it } from 'vitest';
import { DEFAULT_QUICK_ACCESS_LIMIT, moveQuickAccess, quickAccessEntries } from './quick-access';
import type { Group, HubData, HubItem } from './types';

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

const group = (id: string, overrides: Partial<Group> = {}): Group => ({
	id,
	categoryId: 'jogos',
	name: id,
	order: 1,
	pinned: true,
	...overrides
});

const hub = (
	items: HubItem[],
	groups: Group[] = [],
	settings: HubData['settings'] = { accent: '#8AA4FF' }
): HubData => ({
	version: 2,
	settings,
	categories: [{ id: 'jogos', name: 'Jogos', color: '#8AA4FF', order: 1 }],
	groups,
	items,
	feedSources: [],
	savedFilters: []
});

describe('quickAccessEntries', () => {
	it('inclui itens fixados', () => {
		const result = quickAccessEntries(hub([link('a'), link('b', { pinned: false })]));

		expect(result.map((entry) => entry.key)).toEqual(['item:a']);
	});

	it('inclui grupos fixados com a contagem de itens', () => {
		const data = hub(
			[
				link('a'),
				link('b', { groupId: 'darktide', pinned: false }),
				link('c', { groupId: 'darktide', pinned: false })
			],
			[group('darktide')]
		);

		const result = quickAccessEntries(data);

		expect(result.map((entry) => entry.key)).toEqual(['item:a', 'group:darktide']);
		expect(result[1]).toMatchObject({ kind: 'group', count: 2 });
	});

	it('ignora grupo não fixado', () => {
		const data = hub([link('a')], [group('darktide', { pinned: false })]);

		expect(quickAccessEntries(data).map((entry) => entry.key)).toEqual(['item:a']);
	});

	it('respeita a ordem explícita com chaves e ids legados', () => {
		const data = hub([link('a'), link('b')], [group('darktide')], {
			accent: '#8AA4FF',
			quickAccessOrder: ['group:darktide', 'b']
		});

		expect(quickAccessEntries(data).map((entry) => entry.key)).toEqual([
			'group:darktide',
			'item:b',
			'item:a'
		]);
	});

	it('usa order como desempate entre itens', () => {
		const data = hub([link('b', { order: 2 }), link('a', { order: 1 })]);

		expect(quickAccessEntries(data).map((entry) => entry.key)).toEqual(['item:a', 'item:b']);
	});

	it('aplica o limite padrão de nove', () => {
		const items = Array.from({ length: DEFAULT_QUICK_ACCESS_LIMIT + 3 }, (_, index) =>
			link(`i${String(index).padStart(2, '0')}`, { order: index })
		);

		expect(quickAccessEntries(hub(items))).toHaveLength(DEFAULT_QUICK_ACCESS_LIMIT);
	});

	it('aceita limite explícito', () => {
		const data = hub([link('a'), link('b'), link('c')]);

		expect(quickAccessEntries(data, 2)).toHaveLength(2);
	});

	it('aceita limite infinito para listar o overflow', () => {
		const data = hub([link('a'), link('b'), link('c')]);

		expect(quickAccessEntries(data, Number.POSITIVE_INFINITY)).toHaveLength(3);
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
