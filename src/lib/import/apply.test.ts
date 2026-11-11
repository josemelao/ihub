import { describe, expect, it } from 'vitest';
import { EMPTY_HUB } from '../defaults';
import { parseHub } from '../schema';
import type { HubData } from '../types';
import { applyBookmarksImport, applyOpmlImport } from './apply';

function baseHub(): HubData {
	const hub = structuredClone(EMPTY_HUB);
	hub.categories = [{ id: 'jogos', name: 'Jogos', color: '#8AA4FF', order: 1 }];
	hub.groups = [{ id: 'darktide', name: 'Darktide', categoryId: 'jogos', order: 1 }];
	hub.items = [
		{
			id: 'wiki-antiga',
			type: 'link',
			name: 'Wiki antiga',
			url: 'https://example.com/wiki',
			categoryId: 'jogos',
			groupId: 'darktide',
			tags: [],
			pinned: false,
			order: 1
		}
	];
	return hub;
}

describe('applyBookmarksImport', () => {
	it('creates categories, groups and links from folders', () => {
		const result = applyBookmarksImport(baseHub(), {
			bookmarks: [
				{ title: 'Builds', url: 'https://example.com/builds', folderPath: ['Jogos', 'Builds'] },
				{ title: 'Novo site', url: 'https://example.com/novo', folderPath: ['Ferramentas'] },
				{ title: 'Raiz', url: 'https://example.com/raiz', folderPath: [] }
			],
			skipped: 2
		});

		expect(result.summary.itemsAdded).toBe(3);
		expect(result.summary.categoriesAdded).toBe(2);
		expect(result.summary.groupsAdded).toBe(1);
		expect(result.summary.skipped).toBe(2);
		expect(result.hub.categories.map((category) => category.name)).toEqual(
			expect.arrayContaining(['Jogos', 'Ferramentas', 'Importados'])
		);
		expect(result.hub.items.map((item) => item.name)).toEqual(
			expect.arrayContaining(['Builds', 'Novo site', 'Raiz'])
		);
		expect(() => parseHub(result.hub)).not.toThrow();
	});

	it('reuses existing categories and groups', () => {
		const before = baseHub();
		const result = applyBookmarksImport(before, {
			bookmarks: [
				{ title: 'Patch', url: 'https://example.com/patch', folderPath: ['Jogos', 'Darktide'] }
			],
			skipped: 0
		});

		expect(result.hub.categories).toHaveLength(1);
		expect(result.hub.groups).toHaveLength(1);
		const added = result.hub.items.find((item) => item.name === 'Patch');
		expect(added).toMatchObject({ categoryId: 'jogos', groupId: 'darktide' });
	});

	it('skips duplicate URLs and counts them', () => {
		const result = applyBookmarksImport(baseHub(), {
			bookmarks: [{ title: 'Wiki', url: 'https://example.com/wiki', folderPath: ['Jogos'] }],
			skipped: 0
		});

		expect(result.summary.itemsAdded).toBe(0);
		expect(result.summary.duplicates).toBe(1);
		expect(result.hub.items).toHaveLength(1);
	});

	it('uses a fixed category when categoryName is provided', () => {
		const result = applyBookmarksImport(
			baseHub(),
			{
				bookmarks: [
					{ title: 'Builds', url: 'https://example.com/builds', folderPath: ['Jogos', 'Darktide'] }
				],
				skipped: 0
			},
			{ categoryName: 'Favoritos importados' }
		);

		const category = result.hub.categories.find(
			(candidate) => candidate.name === 'Favoritos importados'
		);
		const group = result.hub.groups.find((candidate) => candidate.name === 'Jogos / Darktide');
		const item = result.hub.items.find((candidate) => candidate.name === 'Builds');

		expect(category).toBeDefined();
		expect(group).toMatchObject({ categoryId: category?.id });
		expect(item).toMatchObject({ categoryId: category?.id, groupId: group?.id });
	});

	it('marks imported links with the importado tag', () => {
		const result = applyBookmarksImport(baseHub(), {
			bookmarks: [{ title: 'Novo', url: 'https://example.com/novo', folderPath: ['Jogos'] }],
			skipped: 0
		});

		expect(result.hub.items.at(-1)?.tags).toContain('importado');
	});
});

describe('applyOpmlImport', () => {
	it('creates feed sources with inferred types', () => {
		const result = applyOpmlImport(baseHub(), {
			sources: [
				{
					name: 'r/Darktide',
					feedUrl: 'https://www.reddit.com/r/Darktide/.rss',
					folderPath: ['Jogos', 'Darktide']
				},
				{
					name: 'Canal',
					feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCabcdefghijklmnopqrstu',
					folderPath: ['Jogos']
				},
				{ name: 'Raiz', feedUrl: 'https://example.com/feed.xml', folderPath: [] }
			],
			skipped: 1
		});

		expect(result.summary.sourcesAdded).toBe(3);
		expect(result.summary.skipped).toBe(1);
		expect(result.hub.feedSources).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: 'reddit',
					target: 'https://www.reddit.com/r/Darktide/.rss'
				}),
				expect.objectContaining({ type: 'youtube' }),
				expect.objectContaining({ type: 'rss' })
			])
		);
		expect(() => parseHub(result.hub)).not.toThrow();
	});

	it('reuses existing categories and groups and skips duplicate feeds', () => {
		const hub = baseHub();
		hub.feedSources = [
			{
				id: 'existente',
				type: 'rss',
				name: 'Existente',
				target: 'https://example.com/feed.xml',
				categoryId: 'jogos',
				intervalMinutes: 30,
				enabled: true,
				include: [],
				exclude: [],
				matchMode: 'any'
			}
		];

		const result = applyOpmlImport(hub, {
			sources: [
				{ name: 'Duplicado', feedUrl: 'https://example.com/feed.xml', folderPath: ['Jogos'] },
				{
					name: 'Patch',
					feedUrl: 'https://example.com/patch.xml',
					folderPath: ['Jogos', 'Darktide']
				}
			],
			skipped: 0
		});

		expect(result.summary.sourcesAdded).toBe(1);
		expect(result.summary.duplicates).toBe(1);
		expect(result.summary.categoriesAdded).toBe(0);
		expect(result.summary.groupsAdded).toBe(0);
		const added = result.hub.feedSources.find((entry) => entry.name === 'Patch');
		expect(added).toMatchObject({ categoryId: 'jogos', groupId: 'darktide' });
	});

	it('uses a fixed category and an importado group when categoryName is provided', () => {
		const result = applyOpmlImport(
			baseHub(),
			{
				sources: [
					{ name: 'Feed', feedUrl: 'https://example.com/feed.xml', folderPath: ['Pasta', 'Sub'] }
				],
				skipped: 0
			},
			{ categoryName: 'Feeds novos' }
		);

		const category = result.hub.categories.find((entry) => entry.name === 'Feeds novos');
		const group = result.hub.groups.find((entry) => entry.name === 'Pasta / Sub');
		expect(result.hub.feedSources[0]).toMatchObject({
			categoryId: category?.id,
			groupId: group?.id
		});
	});
});
