import { describe, it, expect } from 'vitest';
import { parseHub, parseHubState, parseFeedCache, HubValidationError } from './schema';

const base = {
	version: 1,
	settings: { accent: '#8AA4FF' },
	categories: [{ id: 'jogos', name: 'Jogos', color: '#8AA4FF', order: 1 }],
	groups: [{ id: 'darktide', categoryId: 'jogos', name: 'Darktide', order: 1 }],
	items: [
		{
			id: 'darktide-reddit',
			type: 'link' as const,
			name: 'Subreddit r/Darktide',
			url: 'https://www.reddit.com/r/Darktide/',
			categoryId: 'jogos',
			groupId: 'darktide'
		}
	],
	feedSources: [],
	savedFilters: []
};

describe('parseHub', () => {
	it('aceita um hub válido e aplica valores padrão', () => {
		const hub = parseHub(base);
		expect(hub.items[0].pinned).toBe(false);
		expect(hub.items[0].order).toBe(0);
		expect(hub.items[0].tags).toEqual([]);
	});

	it('rejeita item que aponta para categoria inexistente com caminho legível', () => {
		const invalid = structuredClone(base);
		invalid.items[0].categoryId = 'nao-existe';

		expect(() => parseHub(invalid)).toThrow(HubValidationError);
		try {
			parseHub(invalid);
		} catch (error) {
			const issues = (error as HubValidationError).issues;
			expect(issues.some((i) => i.path.join('.') === 'items.0.categoryId')).toBe(true);
			expect(issues.some((i) => i.message.includes('categoria'))).toBe(true);
		}
	});

	it('rejeita ids de categoria duplicados', () => {
		const invalid = structuredClone(base);
		invalid.categories.push({ id: 'jogos', name: 'Outra', color: '#7DD3A8', order: 2 });

		expect(() => parseHub(invalid)).toThrow(HubValidationError);
		try {
			parseHub(invalid);
		} catch (error) {
			const issues = (error as HubValidationError).issues;
			expect(issues.some((i) => i.message.toLowerCase().includes('duplicado'))).toBe(true);
		}
	});

	it('rejeita link com URL inválida', () => {
		const invalid = structuredClone(base);
		invalid.items[0].url = 'nao-e-uma-url';

		expect(() => parseHub(invalid)).toThrow(HubValidationError);
	});

	it('rejeita item cujo grupo pertence a outra categoria', () => {
		const invalid = {
			...structuredClone(base),
			categories: [
				...structuredClone(base).categories,
				{ id: 'leitura', name: 'Leitura', color: '#E58BC0', order: 2 }
			],
			groups: [
				...structuredClone(base).groups,
				{ id: 'leitura-geral', categoryId: 'leitura', name: 'Leitura', order: 1 }
			],
			items: [{ ...structuredClone(base).items[0], groupId: 'leitura-geral' }]
		};

		expect(() => parseHub(invalid)).toThrow(HubValidationError);
		try {
			parseHub(invalid);
		} catch (error) {
			const issues = (error as HubValidationError).issues;
			expect(issues.some((i) => i.path.join('.') === 'items.0.groupId')).toBe(true);
			expect(issues.some((i) => i.message.includes('pertence'))).toBe(true);
		}
	});

	it('rejeita app com protocolo perigoso', () => {
		const invalid = {
			version: 1,
			settings: { accent: '#8AA4FF' },
			categories: base.categories,
			groups: base.groups,
			items: [
				{
					id: 'app-perigoso',
					type: 'app',
					name: 'App perigoso',
					launch: { kind: 'protocol', value: 'javascript:alert(1)' },
					categoryId: 'jogos',
					tags: [],
					pinned: false,
					order: 0
				}
			],
			feedSources: [],
			savedFilters: []
		};

		expect(() => parseHub(invalid)).toThrow(HubValidationError);
	});

	it('aceita ícone como slug ou URL', () => {
		const slug = parseHub({
			...structuredClone(base),
			items: [{ ...structuredClone(base).items[0], icon: 'steam' }]
		});
		expect(slug.items[0].icon).toBe('steam');

		const url = parseHub({
			...structuredClone(base),
			items: [{ ...structuredClone(base).items[0], icon: 'https://example.com/icon.png' }]
		});
		expect(url.items[0].icon).toBe('https://example.com/icon.png');
	});

	it('rejeita ícone inválido', () => {
		const invalid = {
			...structuredClone(base),
			items: [{ ...structuredClone(base).items[0], icon: 'javascript:alert(1)' }]
		};

		expect(() => parseHub(invalid)).toThrow(HubValidationError);
	});

	it('aceita descrição curta e limite de posts por fonte', () => {
		const hub = parseHub({
			...structuredClone(base),
			items: [{ ...structuredClone(base).items[0], description: 'Guia completo' }],
			feedSources: [
				{
					id: 'feed',
					type: 'rss',
					name: 'Feed',
					target: 'https://example.com/feed.xml',
					categoryId: 'jogos',
					intervalMinutes: 30,
					maxItems: 50,
					locale: 'en',
					enabled: true,
					include: [],
					exclude: [],
					matchMode: 'any'
				}
			]
		});

		expect(hub.items[0].description).toBe('Guia completo');
		expect(hub.feedSources[0].maxItems).toBe(50);
		expect(hub.feedSources[0].locale).toBe('en');
	});

	it('rejeita descrição longa e limite de posts inválido', () => {
		const longDescription = {
			...structuredClone(base),
			items: [{ ...structuredClone(base).items[0], description: 'x'.repeat(281) }]
		};
		const badLimit = {
			...structuredClone(base),
			feedSources: [
				{
					id: 'feed',
					type: 'rss',
					name: 'Feed',
					target: 'https://example.com/feed.xml',
					categoryId: 'jogos',
					intervalMinutes: 30,
					maxItems: 0,
					enabled: true,
					include: [],
					exclude: [],
					matchMode: 'any'
				}
			]
		};

		expect(() => parseHub(longDescription)).toThrow(HubValidationError);
		expect(() => parseHub(badLimit)).toThrow(HubValidationError);
	});

	it('rejeita locale inválido', () => {
		const invalid = {
			...structuredClone(base),
			feedSources: [
				{
					id: 'feed',
					type: 'rss',
					name: 'Feed',
					target: 'https://example.com/feed.xml',
					categoryId: 'jogos',
					intervalMinutes: 30,
					locale: '../pt',
					enabled: true,
					include: [],
					exclude: [],
					matchMode: 'any'
				}
			]
		};

		expect(() => parseHub(invalid)).toThrow(HubValidationError);
	});
});

describe('parseHubState', () => {
	const item = {
		id: 'post-1',
		sourceId: 'src',
		title: 'Post',
		summary: '',
		url: 'https://example.com/post',
		publishedAt: '2026-11-09T12:00:00Z',
		thumbnail: null
	};

	it('aceita estado válido e aplica defaults', () => {
		const state = parseHubState({
			saved: ['post-1'],
			savedItems: {
				'post-1': {
					item,
					sourceId: 'src',
					sourceName: 'Fonte',
					savedAt: '2026-11-09T12:00:00Z'
				}
			}
		});
		expect(state.read).toEqual({});
		expect(state.savedItems['post-1'].item.url).toBe('https://example.com/post');
	});

	it('rejeita snapshot com URL perigosa', () => {
		expect(() =>
			parseHubState({
				savedItems: {
					'post-1': {
						item: { ...item, url: 'javascript:alert(1)' },
						sourceId: 'src',
						sourceName: 'Fonte',
						savedAt: ''
					}
				}
			})
		).toThrow(HubValidationError);
	});

	it('rejeita snapshot cuja chave não bate com o item', () => {
		expect(() =>
			parseHubState({
				savedItems: {
					outra: {
						item,
						sourceId: 'src',
						sourceName: 'Fonte',
						savedAt: ''
					}
				}
			})
		).toThrow(HubValidationError);
	});
});

describe('parseFeedCache', () => {
	it('aceita cache válido e aplica defaults', () => {
		const cache = parseFeedCache({
			items: [
				{
					id: 'post-1',
					sourceId: 'src',
					title: 'Post',
					url: 'https://example.com/post',
					publishedAt: '2026-11-09T12:00:00Z',
					thumbnail: null
				}
			],
			sources: { src: { error: null, count: 1 } }
		});
		expect(cache.items).toHaveLength(1);
		expect(cache.items[0].summary).toBe('');
		expect(cache.sources.src.lastFetchedAt).toBe('');
	});

	it('rejeita item com URL perigosa', () => {
		expect(() =>
			parseFeedCache({
				items: [
					{
						id: 'post-1',
						sourceId: 'src',
						title: 'Post',
						url: 'data:text/html,oi',
						publishedAt: '',
						thumbnail: null
					}
				]
			})
		).toThrow(HubValidationError);
	});
});
