import { describe, expect, it } from 'vitest';
import { buildSavedView, canOpenEntry } from './view';
import type { FeedCache, HubData, HubState } from '../types';

const hub: HubData = {
	version: 1,
	settings: { accent: '#8AA4FF' },
	categories: [{ id: 'jogos', name: 'Jogos', color: '#8AA4FF', order: 1 }],
	groups: [],
	items: [],
	feedSources: [],
	savedFilters: []
};

const cache: FeedCache = { version: 1, updatedAt: '', items: [], sources: {} };

const state = (overrides: Partial<HubState> = {}): HubState => ({
	version: 1,
	read: {},
	saved: [],
	savedItems: {},
	...overrides
});

describe('buildSavedView com salvos legados', () => {
	it('mostra um placeholder para id salvo sem snapshot', () => {
		const view = buildSavedView(hub, cache, state({ saved: ['perdido'] }));

		expect(view).toHaveLength(1);
		expect(view[0]).toMatchObject({
			missing: true,
			saved: true,
			item: { id: 'perdido', title: 'Conteúdo indisponível' }
		});
		expect(view[0].item.url).toBe('');
	});

	it('marca como indisponível o snapshot com URL insegura', () => {
		const view = buildSavedView(
			hub,
			cache,
			state({
				saved: ['antigo'],
				savedItems: {
					antigo: {
						item: {
							id: 'antigo',
							sourceId: 'fonte',
							title: 'Antigo',
							summary: '',
							url: 'javascript:alert(1)',
							publishedAt: '',
							thumbnail: null
						},
						sourceId: 'fonte',
						sourceName: 'Fonte',
						savedAt: ''
					}
				}
			})
		);

		expect(view[0]).toMatchObject({ missing: true, item: { id: 'antigo' } });
		expect(view[0].item.url).toBe('');
	});

	it('não mostra nada para um id que deixou de estar salvo', () => {
		const view = buildSavedView(hub, cache, state({ saved: [] }));

		expect(view).toHaveLength(0);
	});

	it('mantém os itens normais marcados como salvos', () => {
		const withPost = structuredClone(cache);
		withPost.items.push({
			id: 'vivo',
			sourceId: 'fonte',
			title: 'Vivo',
			summary: '',
			url: 'https://exemplo.test/post',
			publishedAt: '',
			thumbnail: null
		});
		const withSource = structuredClone(hub);
		withSource.feedSources.push({
			id: 'fonte',
			type: 'rss',
			name: 'Fonte',
			target: 'https://exemplo.test/feed',
			categoryId: 'jogos',
			intervalMinutes: 30,
			enabled: true,
			include: [],
			exclude: [],
			matchMode: 'any'
		});

		const view = buildSavedView(
			withSource,
			withPost,
			state({
				saved: ['vivo'],
				savedItems: {
					vivo: { item: withPost.items[0], sourceId: 'fonte', sourceName: 'Fonte', savedAt: '' }
				}
			})
		);

		expect(view[0].missing).toBeUndefined();
		expect(view[0].item.url).toBe('https://exemplo.test/post');
	});
});

describe('canOpenEntry', () => {
	it('bloqueia placeholder sem URL', () => {
		const [placeholder] = buildSavedView(hub, cache, state({ saved: ['perdido'] }));

		expect(canOpenEntry(placeholder)).toBe(false);
	});

	it('libera item com URL segura', () => {
		const withPost = structuredClone(cache);
		withPost.items.push({
			id: 'vivo',
			sourceId: 'fonte',
			title: 'Vivo',
			summary: '',
			url: 'https://exemplo.test/post',
			publishedAt: '',
			thumbnail: null
		});
		const withSource = structuredClone(hub);
		withSource.feedSources.push({
			id: 'fonte',
			type: 'rss',
			name: 'Fonte',
			target: 'https://exemplo.test/feed',
			categoryId: 'jogos',
			intervalMinutes: 30,
			enabled: true,
			include: [],
			exclude: [],
			matchMode: 'any'
		});

		const [entry] = buildSavedView(withSource, withPost, state({ saved: ['vivo'] }));

		expect(canOpenEntry(entry)).toBe(true);
	});
});
