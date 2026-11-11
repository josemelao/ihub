import { describe, expect, it } from 'vitest';
import { searchHub, searchIndexFor } from './search';
import type { FeedCache, HubData } from './types';

const hub = (name = 'Jogos'): HubData => ({
	version: 1,
	settings: { accent: '#8AA4FF' },
	categories: [{ id: 'jogos', name, color: '#8AA4FF', order: 1 }],
	groups: [],
	items: [
		{
			id: 'wiki',
			type: 'link',
			name: 'Wiki',
			url: 'https://exemplo.test/wiki',
			categoryId: 'jogos',
			tags: [],
			pinned: false,
			order: 1
		}
	],
	feedSources: [],
	savedFilters: []
});

const feed = (): FeedCache => ({ version: 1, updatedAt: '', items: [], sources: {} });

describe('índice de busca memoizado', () => {
	it('reaproveita o índice para o mesmo hub e feed', () => {
		const data = hub();
		const posts = feed();

		expect(searchIndexFor(data, posts)).toBe(searchIndexFor(data, posts));
	});

	it('reconstrói quando o feed muda', () => {
		const data = hub();

		expect(searchIndexFor(data, feed())).not.toBe(searchIndexFor(data, feed()));
	});

	it('reconstrói quando o hub muda', () => {
		const posts = feed();

		expect(searchIndexFor(hub(), posts)).not.toBe(searchIndexFor(hub(), posts));
	});

	it('mantém o mesmo resultado da busca', () => {
		const data = hub();
		const posts = feed();

		const first = searchHub(data, 'wiki', 8, posts);
		const second = searchHub(data, 'wiki', 8, posts);

		expect(second).toEqual(first);
		expect(first[0]?.name).toBe('Wiki');
	});

	it('lista tudo quando a busca está vazia', () => {
		const results = searchHub(hub(), '   ', 8, feed());

		expect(results.some((entry) => entry.name === 'Wiki')).toBe(true);
	});
});
