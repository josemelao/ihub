import { describe, it, expect } from 'vitest';
import { updateItem } from './hub-edit';
import { parseHub } from './schema';
import type { HubData } from './types';

const base = (): HubData => ({
	version: 1,
	settings: { accent: '#8AA4FF' },
	categories: [
		{ id: 'jogos', name: 'Jogos', color: '#8AA4FF', order: 1 },
		{ id: 'trabalho', name: 'Trabalho', color: '#F2A65A', order: 2 }
	],
	groups: [
		{ id: 'darktide', categoryId: 'jogos', name: 'Darktide', order: 1 },
		{ id: 'reunioes', categoryId: 'trabalho', name: 'Reuniões', order: 1 }
	],
	items: [
		{
			id: 'darktide-reddit',
			type: 'link',
			name: 'Subreddit',
			url: 'https://reddit.com/r/Darktide',
			categoryId: 'jogos',
			groupId: 'darktide',
			tags: [],
			pinned: false,
			order: 1
		},
		{
			id: 'wiki',
			type: 'link',
			name: 'Wiki',
			url: 'https://example.com/wiki',
			categoryId: 'jogos',
			groupId: 'darktide',
			tags: [],
			pinned: false,
			order: 2
		},
		{
			id: 'ata',
			type: 'link',
			name: 'Ata',
			url: 'https://example.com/ata',
			categoryId: 'trabalho',
			groupId: 'reunioes',
			tags: [],
			pinned: false,
			order: 1
		},
		{
			id: 'planilha',
			type: 'link',
			name: 'Planilha',
			url: 'https://example.com/planilha',
			categoryId: 'trabalho',
			tags: [],
			pinned: false,
			order: 1
		},
		{
			id: 'relatorio',
			type: 'link',
			name: 'Relatório',
			url: 'https://example.com/relatorio',
			categoryId: 'trabalho',
			tags: [],
			pinned: false,
			order: 2
		}
	],
	feedSources: [],
	savedFilters: []
});

const orderOf = (hub: HubData, id: string) => hub.items.find((item) => item.id === id)?.order;

describe('updateItem keeps destination order consistent', () => {
	it('appends a moved item to the end of the destination group', () => {
		const moved = updateItem(base(), 'planilha', { categoryId: 'trabalho', groupId: 'reunioes' });

		expect(orderOf(moved, 'planilha')).toBe(2);
		expect(() => parseHub(moved)).not.toThrow();
	});

	it('uses order 1 when the destination group is empty', () => {
		const hub = base();
		hub.groups.push({ id: 'vazio', categoryId: 'trabalho', name: 'Vazio', order: 2 });

		const moved = updateItem(hub, 'planilha', { categoryId: 'trabalho', groupId: 'vazio' });

		expect(orderOf(moved, 'planilha')).toBe(1);
	});

	it('appends to the category level when the item leaves its group', () => {
		const moved = updateItem(base(), 'darktide-reddit', {
			categoryId: 'trabalho',
			groupId: null
		});

		expect(orderOf(moved, 'darktide-reddit')).toBe(3);
		expect(moved.items.find((item) => item.id === 'darktide-reddit')?.groupId).toBeUndefined();
	});

	it('never leaves duplicated orders in the destination', () => {
		const moved = updateItem(base(), 'planilha', { categoryId: 'trabalho', groupId: 'reunioes' });
		const destination = moved.items.filter(
			(item) => item.categoryId === 'trabalho' && item.groupId === 'reunioes'
		);

		expect(new Set(destination.map((item) => item.order)).size).toBe(destination.length);
	});

	it('drops a group that belongs to another category', () => {
		const moved = updateItem(base(), 'planilha', { categoryId: 'jogos', groupId: 'reunioes' });

		expect(moved.items.find((item) => item.id === 'planilha')?.groupId).toBeUndefined();
		expect(orderOf(moved, 'planilha')).toBe(1);
		expect(() => parseHub(moved)).not.toThrow();
	});

	it('keeps the order when the item does not change bucket', () => {
		const moved = updateItem(base(), 'wiki', { name: 'Wiki nova' });

		expect(orderOf(moved, 'wiki')).toBe(2);
	});
});
