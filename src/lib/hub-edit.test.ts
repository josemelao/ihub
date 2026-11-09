import { describe, it, expect } from 'vitest';
import {
	addApp,
	addCategory,
	addLink,
	addSavedFilter,
	addSource,
	moveItem,
	removeCategory,
	removeItem,
	removeSavedFilter,
	removeSource,
	toggleSource,
	updateItem,
	updateSource
} from './hub-edit';
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

describe('addLink', () => {
	it('cria link com id único, ordem no fim do grupo e dados válidos', () => {
		const hub = addLink(base(), {
			name: 'Calculadora',
			url: 'https://example.com/calc',
			categoryId: 'jogos',
			groupId: 'darktide',
			tags: ['build']
		});

		const created = hub.items.find((item) => item.id === 'calculadora');
		expect(created).toMatchObject({ type: 'link', order: 3, pinned: false });
		expect(() => parseHub(hub)).not.toThrow();
	});

	it('gera id alternativo quando o slug já existe', () => {
		const hub = addLink(base(), {
			name: 'Wiki',
			url: 'https://example.com/wiki-2',
			categoryId: 'jogos'
		});
		const ids = hub.items.map((item) => item.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids).toContain('wiki-2');
	});
});

describe('addApp', () => {
	it('cria app com protocolo', () => {
		const hub = addApp(base(), {
			name: 'Abrir jogo',
			launchValue: 'steam://run/1',
			categoryId: 'jogos'
		});
		const created = hub.items.find((item) => item.id === 'abrir-jogo');
		expect(created).toMatchObject({
			type: 'app',
			launch: { kind: 'protocol', value: 'steam://run/1' }
		});
		expect(() => parseHub(hub)).not.toThrow();
	});
});

describe('updateItem e removeItem', () => {
	it('atualiza campos do item', () => {
		const hub = updateItem(base(), 'wiki', { name: 'Wiki nova', url: 'https://example.com/new' });
		expect(hub.items.find((item) => item.id === 'wiki')).toMatchObject({
			name: 'Wiki nova',
			url: 'https://example.com/new'
		});
	});

	it('remove item', () => {
		const hub = removeItem(base(), 'wiki');
		expect(hub.items.map((item) => item.id)).not.toContain('wiki');
	});
});

describe('moveItem', () => {
	it('troca a ordem com o vizinho', () => {
		const hub = moveItem(base(), 'wiki', 'up');
		expect(hub.items.find((item) => item.id === 'wiki')?.order).toBe(1);
		expect(hub.items.find((item) => item.id === 'darktide-reddit')?.order).toBe(2);
	});

	it('não faz nada no limite', () => {
		const hub = moveItem(base(), 'darktide-reddit', 'up');
		expect(hub.items.find((item) => item.id === 'darktide-reddit')?.order).toBe(1);
	});
});

describe('fontes', () => {
	it('liga/desliga a fonte', () => {
		const hub = toggleSource(base(), 'reddit-patch');
		expect(hub.feedSources[0].enabled).toBe(false);
	});

	it('adiciona e remove fonte', () => {
		const hub = addSource(base(), {
			type: 'rss',
			name: 'Blog',
			target: 'https://blog.example.com/feed',
			categoryId: 'jogos',
			intervalMinutes: 60,
			enabled: true,
			include: [],
			exclude: [],
			matchMode: 'any'
		});
		expect(hub.feedSources.map((source) => source.id)).toContain('blog');

		const removed = removeSource(hub, 'blog');
		expect(removed.feedSources.map((source) => source.id)).not.toContain('blog');
	});

	it('atualiza fonte', () => {
		const hub = updateSource(base(), 'reddit-patch', { intervalMinutes: 120, enabled: false });
		expect(hub.feedSources[0]).toMatchObject({ intervalMinutes: 120, enabled: false });
	});
});

describe('categorias e filtros', () => {
	it('adiciona categoria', () => {
		const hub = addCategory(base(), { name: 'Leitura', color: '#E58BC0' });
		expect(hub.categories.map((category) => category.id)).toContain('leitura');
		expect(() => parseHub(hub)).not.toThrow();
	});

	it('não remove categoria em uso', () => {
		expect(() => removeCategory(base(), 'jogos')).toThrow(/em uso/i);
	});

	it('remove categoria vazia', () => {
		const hub = removeCategory(base(), 'trabalho');
		expect(hub.categories.map((category) => category.id)).not.toContain('trabalho');
	});

	it('adiciona e remove filtro salvo', () => {
		const hub = addSavedFilter(base(), {
			label: 'hotfix',
			include: ['hotfix'],
			exclude: [],
			matchMode: 'any'
		});
		expect(hub.savedFilters.map((filter) => filter.id)).toContain('hotfix');

		const removed = removeSavedFilter(hub, 'hotfix');
		expect(removed.savedFilters).toHaveLength(0);
	});
});
