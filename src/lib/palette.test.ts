import { describe, expect, it } from 'vitest';
import { buildPaletteItems, searchPalette } from './palette';
import type { FeedCache, HubData, HubState, NotesData } from './types';

const hub = (): HubData => ({
	version: 2,
	settings: { accent: '#8AA4FF' },
	categories: [{ id: 'jogos', name: 'Jogos', color: '#8AA4FF', order: 1 }],
	groups: [],
	items: [
		{
			id: 'wiki',
			type: 'link',
			name: 'Wiki',
			url: 'https://exemplo.test/wiki',
			categoryId: 'jogos',
			tags: ['build'],
			pinned: false,
			order: 1
		},
		{
			id: 'steam',
			type: 'app',
			name: 'Steam',
			launch: { kind: 'protocol', value: 'steam://' },
			categoryId: 'jogos',
			tags: [],
			pinned: false,
			order: 2
		}
	],
	feedSources: [
		{
			id: 'fonte-rss',
			type: 'rss',
			name: 'Notícias',
			target: 'https://exemplo.test/feed',
			categoryId: 'jogos',
			intervalMinutes: 30,
			enabled: true,
			include: [],
			exclude: [],
			matchMode: 'any'
		}
	],
	savedFilters: []
});

const feed = (): FeedCache => ({
	version: 1,
	updatedAt: '',
	items: [
		{
			id: 'post-1',
			sourceId: 'fonte-rss',
			title: 'Patch novo',
			summary: '',
			url: 'https://exemplo.test/1',
			publishedAt: '',
			thumbnail: null
		},
		{
			id: 'post-2',
			sourceId: 'fonte-rss',
			title: 'Outro post',
			summary: '',
			url: 'https://exemplo.test/2',
			publishedAt: '',
			thumbnail: null
		}
	],
	sources: {}
});

const state = (overrides: Partial<HubState> = {}): HubState => ({
	version: 1,
	read: {},
	saved: [],
	savedItems: {},
	...overrides
});

const notes = (): NotesData => ({
	version: 1,
	notes: [
		{
			id: 'rapida',
			text: 'lembrar do build',
			createdAt: '2026-01-01T00:00:00.000Z',
			updatedAt: '2026-01-01T00:00:00.000Z'
		}
	]
});

const items = () => buildPaletteItems({ hub: hub(), feed: feed(), state: state(), notes: notes() });

describe('buildPaletteItems', () => {
	it('indexa links, apps, posts, notas, fontes e comandos', () => {
		const types = new Set(items().map((item) => item.type));

		expect(types).toEqual(
			new Set(['command', 'category', 'link', 'app', 'post', 'note', 'source'])
		);
	});
});

describe('searchPalette', () => {
	it('encontra pelo título', () => {
		const results = searchPalette(items(), 'wiki');

		expect(results[0]?.title).toBe('Wiki');
	});

	it('ignora acentos e caixa', () => {
		expect(searchPalette(items(), 'noticias').some((item) => item.type === 'source')).toBe(true);
	});

	it('" > " mostra só comandos', () => {
		const results = searchPalette(items(), '>');

		expect(results.length).toBeGreaterThan(0);
		expect(results.every((item) => item.type === 'command')).toBe(true);
	});

	it('comando "adicionar" encontra Adicionar link/fonte', () => {
		const results = searchPalette(items(), '>adicionar');
		const ids = results.map((item) => item.commandId);

		expect(ids).toContain('add-link');
		expect(ids).toContain('add-source');
	});

	it('filtra por tag', () => {
		const results = searchPalette(items(), 'tag:build');

		expect(results.map((item) => item.title)).toEqual(['Wiki']);
	});

	it('filtra posts não lidos', () => {
		const index = buildPaletteItems({
			hub: hub(),
			feed: feed(),
			state: state({ read: { 'post-2': '2026-01-01T00:00:00.000Z' } }),
			notes: notes()
		});
		const results = searchPalette(index, 'is:unread');

		expect(results.map((item) => item.title)).toEqual(['Patch novo']);
	});

	it('filtra posts salvos', () => {
		const index = buildPaletteItems({
			hub: hub(),
			feed: feed(),
			state: state({ saved: ['post-2'] }),
			notes: notes()
		});

		expect(searchPalette(index, 'is:saved').map((item) => item.title)).toEqual(['Outro post']);
	});

	it('filtra por fonte', () => {
		const results = searchPalette(items(), 'source:Notícias');

		expect(results.every((item) => item.type === 'post')).toBe(true);
		expect(results).toHaveLength(2);
	});

	it('busca no texto das notas', () => {
		const results = searchPalette(items(), 'lembrar');

		expect(results.some((item) => item.type === 'note')).toBe(true);
	});

	it('respeita o limite', () => {
		expect(searchPalette(items(), '', 3)).toHaveLength(3);
	});

	it('começa pelos comandos quando a busca está vazia', () => {
		const results = searchPalette(items(), '', 3);

		expect(results.every((item) => item.type === 'command')).toBe(true);
	});

	it('dá destino para fontes e notas', () => {
		const results = searchPalette(items(), 'noticias');
		const source = results.find((item) => item.type === 'source');
		const note = searchPalette(items(), 'lembrar').find((item) => item.type === 'note');

		expect(source?.href).toContain('/feed?fonte=');
		expect(note?.href).toBe('/#t-nota');
	});

	it('encontra salvo fora dos 20 posts recentes', () => {
		const many = feed();
		many.items = Array.from({ length: 25 }, (_, index) => ({
			id: `post-${index}`,
			sourceId: 'fonte-rss',
			title: `Post ${index}`,
			summary: '',
			url: `https://exemplo.test/${index}`,
			publishedAt: '',
			thumbnail: null
		}));
		const savedState = state({ saved: ['post-0'] });
		const index = buildPaletteItems({ hub: hub(), feed: many, state: savedState, notes: notes() });

		const results = searchPalette(index, 'is:saved');

		expect(results.map((item) => item.title)).toEqual(['Post 0']);
	});
});
