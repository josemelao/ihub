import { describe, expect, it } from 'vitest';
import { EMPTY_HUB } from '../defaults';
import type { HubData } from '../types';
import { parseBookmarksHtml } from './bookmarks';
import { buildBookmarksHtml } from './bookmarks-export';

function hub(): HubData {
	const data = structuredClone(EMPTY_HUB);
	data.categories = [
		{ id: 'jogos', name: 'Jogos & Cia', color: '#8AA4FF', order: 1 },
		{ id: 'noticias', name: 'Notícias', color: '#7DD3A8', order: 2 }
	];
	data.groups = [{ id: 'darktide', name: 'Darktide', categoryId: 'jogos', order: 1 }];
	data.items = [
		{
			id: 'direto',
			type: 'link',
			name: 'Direto',
			url: 'https://example.com/direto',
			categoryId: 'jogos',
			tags: [],
			pinned: false,
			order: 1
		},
		{
			id: 'grupo',
			type: 'link',
			name: 'A & B <C>',
			url: 'https://example.com/grupo?a=1&b=2',
			categoryId: 'jogos',
			groupId: 'darktide',
			tags: [],
			pinned: false,
			order: 1
		},
		{
			id: 'outra',
			type: 'link',
			name: 'Outra',
			url: 'https://example.com/outra',
			categoryId: 'noticias',
			tags: [],
			pinned: false,
			order: 1
		},
		{
			id: 'app',
			type: 'app',
			name: 'App',
			launch: { kind: 'protocol', value: 'steam://run/1' },
			categoryId: 'jogos',
			tags: [],
			pinned: false,
			order: 2
		}
	];
	return data;
}

describe('buildBookmarksHtml', () => {
	it('round-trips links, names, URLs and folder paths', () => {
		const { bookmarks } = parseBookmarksHtml(buildBookmarksHtml(hub()));

		expect(bookmarks).toEqual(
			expect.arrayContaining([
				{ title: 'Direto', url: 'https://example.com/direto', folderPath: ['Jogos & Cia'] },
				{
					title: 'A & B <C>',
					url: 'https://example.com/grupo?a=1&b=2',
					folderPath: ['Jogos & Cia', 'Darktide']
				},
				{ title: 'Outra', url: 'https://example.com/outra', folderPath: ['Notícias'] }
			])
		);
		expect(bookmarks).toHaveLength(3);
	});

	it('produces a Netscape bookmark file', () => {
		const html = buildBookmarksHtml(hub());

		expect(html).toContain('<!DOCTYPE NETSCAPE-Bookmark-file-1>');
		expect(html).toContain('<H3>Jogos &amp; Cia</H3>');
		expect(html).not.toContain('steam://run/1');
	});
});
