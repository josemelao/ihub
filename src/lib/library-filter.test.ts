import { describe, expect, it } from 'vitest';
import { matchesLibraryItem, searchTerms } from './library-filter';
import type { HubItem } from './types';

const link: HubItem = {
	id: 'a',
	type: 'link',
	name: 'Guia de builds',
	url: 'https://example.com/builds',
	categoryId: 'jogos',
	tags: ['Build', 'Pré venda'],
	description: 'Como montar o personagem',
	pinned: false,
	order: 1
};

const app: HubItem = {
	id: 'b',
	type: 'app',
	name: 'Abrir jogo',
	launch: { kind: 'protocol', value: 'steam://run/1' },
	categoryId: 'jogos',
	tags: ['steam'],
	pinned: false,
	order: 2
};

describe('searchTerms', () => {
	it('ignores case and accents', () => {
		expect(searchTerms('  PRÉ   venda ')).toEqual(['pre', 'venda']);
	});

	it('returns an empty list for blank input', () => {
		expect(searchTerms('   ')).toEqual([]);
	});
});

describe('matchesLibraryItem', () => {
	it('filters by tag', () => {
		expect(
			matchesLibraryItem(link, 'Jogos', 'Darktide', { tab: 'todos', query: '', tagKey: 'build' })
		).toBe(true);
		expect(
			matchesLibraryItem(app, 'Jogos', 'Darktide', { tab: 'todos', query: '', tagKey: 'build' })
		).toBe(false);
	});

	it('filters by type', () => {
		expect(
			matchesLibraryItem(link, 'Jogos', 'Darktide', { tab: 'link', query: '', tagKey: '' })
		).toBe(true);
		expect(
			matchesLibraryItem(app, 'Jogos', 'Darktide', { tab: 'link', query: '', tagKey: '' })
		).toBe(false);
	});

	it('combines search, tag and type', () => {
		expect(
			matchesLibraryItem(link, 'Jogos', 'Darktide', {
				tab: 'link',
				query: 'pre venda',
				tagKey: 'build'
			})
		).toBe(true);
		expect(
			matchesLibraryItem(link, 'Jogos', 'Darktide', {
				tab: 'app',
				query: 'pre venda',
				tagKey: 'build'
			})
		).toBe(false);
	});

	it('rejects an unknown tag', () => {
		expect(
			matchesLibraryItem(link, 'Jogos', 'Darktide', {
				tab: 'todos',
				query: '',
				tagKey: 'inexistente'
			})
		).toBe(false);
	});

	it('matches by category, group, name, tag and description', () => {
		for (const query of ['jogos', 'darktide', 'guia', 'build', 'personagem']) {
			expect(
				matchesLibraryItem(link, 'Jogos', 'Darktide', { tab: 'todos', query, tagKey: '' })
			).toBe(true);
		}
	});
});
