import { describe, it, expect } from 'vitest';
import { buildSearchEntries, searchHub } from './search';
import type { HubData } from './types';

const hub: HubData = {
	version: 1,
	settings: { accent: '#8AA4FF' },
	categories: [
		{ id: 'jogos', name: 'Jogos', color: '#8AA4FF', order: 1 },
		{ id: 'noticias', name: 'Notícias', color: '#F2A65A', order: 2 }
	],
	groups: [{ id: 'darktide', categoryId: 'jogos', name: 'Darktide', order: 1 }],
	items: [
		{
			id: 'darktide-app',
			type: 'app',
			name: 'Abrir Darktide',
			launch: { kind: 'protocol', value: 'steam://run/1361210' },
			categoryId: 'jogos',
			groupId: 'darktide',
			tags: ['steam'],
			pinned: true,
			order: 1
		},
		{
			id: 'darktide-reddit',
			type: 'link',
			name: 'Subreddit r/Darktide',
			url: 'https://www.reddit.com/r/Darktide/',
			categoryId: 'jogos',
			groupId: 'darktide',
			tags: ['reddit'],
			pinned: false,
			order: 2
		},
		{
			id: 'ferramentas-github',
			type: 'link',
			name: 'GitHub',
			url: 'https://github.com/',
			categoryId: 'noticias',
			tags: ['código'],
			pinned: false,
			order: 1
		}
	],
	feedSources: [],
	savedFilters: []
};

describe('buildSearchEntries', () => {
	it('cria entradas de itens e categorias com href correto', () => {
		const entries = buildSearchEntries(hub);
		const categoria = entries.find((entry) => entry.id === 'category:jogos');
		const app = entries.find((entry) => entry.id === 'item:darktide-app');

		expect(categoria?.href).toBe('/c/jogos');
		expect(app?.href).toBe('steam://run/1361210');
		expect(app?.type).toBe('app');
	});
});

describe('searchHub', () => {
	it('encontra item por parte do nome', () => {
		const results = searchHub(hub, 'dark');
		expect(results.some((entry) => entry.id === 'item:darktide-app')).toBe(true);
	});

	it('ignora acentos', () => {
		const results = searchHub(hub, 'noticias');
		expect(results.some((entry) => entry.id === 'category:noticias')).toBe(true);
	});

	it('tolera erro de digitação', () => {
		const results = searchHub(hub, 'darktde');
		expect(results.some((entry) => entry.id.startsWith('item:darktide'))).toBe(true);
	});

	it('retorna sugestões fixadas quando a busca está vazia', () => {
		const results = searchHub(hub, '', 1);
		expect(results).toHaveLength(1);
		expect(results[0].id).toBe('item:darktide-app');
	});

	it('respeita o limite de resultados', () => {
		const results = searchHub(hub, 'a', 2);
		expect(results.length).toBeLessThanOrEqual(2);
	});
});
