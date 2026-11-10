import { describe, it, expect } from 'vitest';
import { applyHubAction } from './hub-actions';
import { parseHub } from './schema';
import type { HubData } from './types';

const base = (): HubData => ({
	version: 1,
	settings: { accent: '#8AA4FF' },
	categories: [
		{ id: 'jogos', name: 'Jogos', color: '#8AA4FF', order: 1 },
		{ id: 'trabalho', name: 'Trabalho', color: '#F2A65A', order: 2 }
	],
	groups: [{ id: 'darktide', categoryId: 'jogos', name: 'Darktide', order: 1 }],
	items: [
		{
			id: 'wiki',
			type: 'link',
			name: 'Wiki',
			url: 'https://example.com/wiki',
			categoryId: 'jogos',
			groupId: 'darktide',
			tags: [],
			pinned: false,
			order: 1
		}
	],
	feedSources: [
		{
			id: 'reddit-patch',
			type: 'reddit',
			name: 'r/Darktide (patch)',
			target: 'Darktide',
			categoryId: 'jogos',
			groupId: 'darktide',
			intervalMinutes: 30,
			enabled: true,
			include: ['patch'],
			exclude: [],
			matchMode: 'any'
		}
	],
	savedFilters: []
});

describe('applyHubAction', () => {
	it('liga e desliga a fonte', () => {
		const result = applyHubAction(base(), { action: 'toggle-source', id: 'reddit-patch' });
		expect(result.feedSources[0].enabled).toBe(false);
		expect(() => parseHub(result)).not.toThrow();
	});

	it('adiciona link com os campos certos', () => {
		const result = applyHubAction(base(), {
			action: 'add-item',
			item: {
				type: 'link',
				name: 'Novo',
				url: 'https://example.com/new',
				categoryId: 'jogos'
			}
		});
		expect(result.items.map((item) => item.id)).toContain('novo');
	});

	it('atualiza a fonte removendo o grupo', () => {
		const result = applyHubAction(base(), {
			action: 'update-source',
			id: 'reddit-patch',
			sourcePatch: { groupId: null }
		});
		expect(result.feedSources[0].groupId).toBeUndefined();
	});

	it('atualiza categoria', () => {
		const result = applyHubAction(base(), {
			action: 'update-category',
			id: 'trabalho',
			category: { name: 'Trabalho novo', color: '#123456' }
		});
		expect(result.categories[1]).toMatchObject({ name: 'Trabalho novo', color: '#123456' });
	});

	it('adiciona e reordena grupo', () => {
		const added = applyHubAction(base(), {
			action: 'add-group',
			group: { name: 'Novo', categoryId: 'jogos' }
		});
		expect(added.groups.map((group) => group.id)).toContain('novo');

		const moved = applyHubAction(added, { action: 'move-group', id: 'novo', direction: 'up' });
		expect(moved.groups.find((group) => group.id === 'novo')?.order).toBe(1);
	});

	it('rejeita direção inválida', () => {
		expect(() =>
			applyHubAction(base(), {
				action: 'move-item',
				id: 'wiki',
				direction: 'left' as 'up'
			})
		).toThrow(/Direção inválida/);
	});

	it('atualiza filtro salvo', () => {
		const withFilter = applyHubAction(base(), {
			action: 'add-filter',
			filter: { label: 'beta', include: ['beta'], exclude: [], matchMode: 'any' }
		});
		const result = applyHubAction(withFilter, {
			action: 'update-filter',
			id: 'beta',
			filter: { label: 'beta novo', include: ['beta'], exclude: ['alpha'], matchMode: 'all' }
		});
		expect(result.savedFilters[0]).toMatchObject({
			label: 'beta novo',
			exclude: ['alpha'],
			matchMode: 'all'
		});
	});

	it('rejeita ação desconhecida', () => {
		expect(() => applyHubAction(base(), { action: 'explodir' })).toThrow(/Ação inválida/);
	});

	it('exige id nas ações que precisam', () => {
		expect(() => applyHubAction(base(), { action: 'delete-item' })).toThrow(/id/);
	});
});
