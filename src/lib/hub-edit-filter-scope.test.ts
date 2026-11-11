import { describe, it, expect } from 'vitest';
import { updateGroup, updateSource } from './hub-edit';
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
	items: [],
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
			matchMode: 'any',
			order: 1
		},
		{
			id: 'noticias',
			type: 'rss',
			name: 'Notícias',
			target: 'https://example.com/feed.xml',
			categoryId: 'trabalho',
			intervalMinutes: 30,
			enabled: true,
			include: [],
			exclude: [],
			matchMode: 'any',
			order: 1
		}
	],
	savedFilters: [
		{
			id: 'patch-jogos',
			label: 'Patch em Jogos',
			include: ['patch'],
			exclude: [],
			matchMode: 'any',
			categoryId: 'jogos',
			sourceId: 'reddit-patch'
		},
		{
			id: 'so-fonte',
			label: 'Só a fonte',
			include: ['patch'],
			exclude: [],
			matchMode: 'any',
			sourceId: 'reddit-patch'
		},
		{
			id: 'outro',
			label: 'Outro',
			include: ['noticias'],
			exclude: [],
			matchMode: 'any',
			categoryId: 'trabalho',
			sourceId: 'noticias'
		}
	]
});

describe('saved filter scope follows moved sources', () => {
	it('updates category of a filter that pins category and source', () => {
		const moved = updateSource(base(), 'reddit-patch', {
			categoryId: 'trabalho',
			groupId: null
		});

		expect(moved.savedFilters.find((filter) => filter.id === 'patch-jogos')).toMatchObject({
			categoryId: 'trabalho',
			sourceId: 'reddit-patch'
		});
		expect(() => parseHub(moved)).not.toThrow();
	});

	it('does not give a category to a filter that only pins the source', () => {
		const moved = updateSource(base(), 'reddit-patch', {
			categoryId: 'trabalho',
			groupId: null
		});

		const filter = moved.savedFilters.find((entry) => entry.id === 'so-fonte');
		expect(filter?.categoryId).toBeUndefined();
	});

	it('leaves filters from other sources untouched', () => {
		const moved = updateSource(base(), 'reddit-patch', {
			categoryId: 'trabalho',
			groupId: null
		});

		expect(moved.savedFilters.find((filter) => filter.id === 'outro')).toMatchObject({
			categoryId: 'trabalho',
			sourceId: 'noticias'
		});
	});

	it('drops a group that does not belong to the destination category', () => {
		const moved = updateSource(base(), 'reddit-patch', { categoryId: 'trabalho' });

		expect(
			moved.feedSources.find((source) => source.id === 'reddit-patch')?.groupId
		).toBeUndefined();
		expect(() => parseHub(moved)).not.toThrow();
	});

	it('keeps the group when the destination category owns it', () => {
		const withGroup = base();
		withGroup.groups.push({
			id: 'trabalho-extra',
			categoryId: 'trabalho',
			name: 'Extra',
			order: 2
		});

		const moved = updateSource(withGroup, 'reddit-patch', {
			categoryId: 'trabalho',
			groupId: 'trabalho-extra'
		});

		expect(moved.feedSources.find((source) => source.id === 'reddit-patch')?.groupId).toBe(
			'trabalho-extra'
		);
	});

	it('follows the sources when a group moves to another category', () => {
		const moved = updateGroup(base(), 'darktide', { categoryId: 'trabalho' });

		expect(moved.savedFilters.find((filter) => filter.id === 'patch-jogos')).toMatchObject({
			categoryId: 'trabalho',
			sourceId: 'reddit-patch'
		});
		expect(() => parseHub(moved)).not.toThrow();
	});
});
