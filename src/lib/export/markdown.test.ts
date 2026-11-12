import { describe, expect, it } from 'vitest';
import { buildMarkdownExport } from './markdown';
import type { ArchiveIndex, FeedCache, HighlightsData, HubData, HubState } from '../types';

const hub: HubData = {
	version: 2,
	settings: { accent: '#8AA4FF' },
	categories: [{ id: 'jogos', name: 'Jogos', color: '#8AA4FF', order: 1 }],
	groups: [],
	items: [],
	feedSources: [
		{
			id: 's',
			type: 'rss',
			name: 'Fonte E2E',
			target: 'https://e.com/f',
			categoryId: 'jogos',
			intervalMinutes: 30,
			enabled: true,
			include: [],
			exclude: [],
			matchMode: 'any'
		}
	],
	savedFilters: []
};

const state: HubState = {
	version: 1,
	read: {},
	saved: ['a', 'b'],
	savedItems: {
		a: {
			item: {
				id: 'a',
				sourceId: 's',
				title: 'Post: "A"',
				summary: 'Resumo A',
				url: 'https://e.com/a',
				publishedAt: '2026-01-01T00:00:00.000Z',
				thumbnail: null
			},
			sourceId: 's',
			sourceName: 'Fonte E2E',
			categoryId: 'jogos',
			categoryName: 'Jogos',
			savedAt: '2026-02-01T00:00:00.000Z'
		},
		b: {
			item: {
				id: 'b',
				sourceId: 's',
				title: 'Post B',
				summary: 'Resumo B',
				url: 'https://e.com/b',
				publishedAt: '2026-01-02T00:00:00.000Z',
				thumbnail: null
			},
			sourceId: 's',
			sourceName: 'Fonte E2E',
			categoryId: 'jogos',
			categoryName: 'Jogos',
			savedAt: '2026-02-02T00:00:00.000Z'
		}
	}
};

const feed: FeedCache = {
	version: 1,
	updatedAt: '',
	sources: {},
	items: [
		{
			id: 'c',
			sourceId: 's',
			title: 'Só destaque',
			summary: 'Resumo C',
			url: 'https://e.com/c',
			publishedAt: '2026-01-03T00:00:00.000Z',
			thumbnail: null
		}
	]
};

const highlights: HighlightsData = {
	version: 1,
	highlights: [
		{
			id: 'h1',
			itemId: 'a',
			itemTitle: 'Post: "A"',
			itemUrl: 'https://e.com/a',
			quote: 'trecho "especial"',
			note: 'nota: com dois pontos\ne quebra',
			color: 'yellow',
			occurrence: 0,
			createdAt: '2026-03-01T00:00:00.000Z',
			updatedAt: '2026-03-01T00:00:00.000Z'
		},
		{
			id: 'h2',
			itemId: 'c',
			itemTitle: 'Só destaque',
			itemUrl: 'https://e.com/c',
			quote: 'trecho do destaque solto',
			color: 'blue',
			occurrence: 0,
			createdAt: '2026-03-02T00:00:00.000Z',
			updatedAt: '2026-03-02T00:00:00.000Z'
		}
	]
};

const archives: ArchiveIndex = {
	version: 1,
	entries: {
		a: {
			id: 'a',
			status: 'ready',
			title: 'Post: "A"',
			url: 'https://e.com/a',
			bytes: 10,
			assets: 1,
			createdAt: '2026-03-01T00:00:00.000Z',
			updatedAt: '2026-03-01T00:00:00.000Z'
		}
	}
};

const input = {
	hub,
	state,
	feed,
	highlights,
	archives,
	baseUrl: 'http://127.0.0.1:5757',
	now: new Date('2026-11-12T12:00:00.000Z')
};

describe('buildMarkdownExport', () => {
	it('gera um arquivo por salvo ou destacado, com nomes únicos', () => {
		const result = buildMarkdownExport(input);

		expect(result.files).toHaveLength(3);
		const names = result.files.map((file) => file.name);
		expect(new Set(names).size).toBe(3);
		expect(names.every((name) => name.endsWith('.md'))).toBe(true);
	});

	it('inclui frontmatter com url, datas, tags e links do hub', () => {
		const file = buildMarkdownExport(input).files.find((entry) => entry.name.includes('-a.md'));
		expect(file).toBeDefined();
		const content = file!.content;

		expect(content).toContain('url: "https://e.com/a"');
		expect(content).toContain('savedAt: "2026-02-01T00:00:00.000Z"');
		expect(content).toContain('- "jogos"');
		expect(content).toContain('- "fonte-e2e"');
		expect(content).toContain('archived: true');
		expect(content).toContain('http://127.0.0.1:5757/ler/a');
		expect(content).toContain('http://127.0.0.1:5757/arquivo/a');
	});

	it('escapa YAML e quebras de linha', () => {
		const content = buildMarkdownExport(input).files.find((entry) =>
			entry.name.includes('-a.md')
		)!.content;

		expect(content).toContain('title: "Post: \\"A\\""');
		expect(content).toContain('nota: com dois pontos e quebra');
	});

	it('inclui item só com destaque como não salvo, usando o feed', () => {
		const file = buildMarkdownExport(input).files.find((entry) => entry.name.includes('-c.md'))!;

		expect(file.content).toContain('saved: false');
		expect(file.content).toContain('Resumo C');
		expect(file.content).toContain('- "jogos"');
		expect(file.content).toContain('### azul');
		expect(file.content).toContain('trecho do destaque solto');
	});

	it('index lista todos os itens', () => {
		const result = buildMarkdownExport(input);

		expect(result.index).toContain('Export do Meu Hub');
		for (const file of result.files) expect(result.index).toContain(file.name);
	});

	it('exporta índice vazio explicando quando não há itens', () => {
		const result = buildMarkdownExport({
			...input,
			state: { version: 1, read: {}, saved: [], savedItems: {} },
			highlights: { version: 1, highlights: [] }
		});

		expect(result.files).toEqual([]);
		expect(result.index).toContain('Nenhum item');
	});
});
