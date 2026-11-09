import { describe, it, expect } from 'vitest';
import { buildFeedView } from './view';
import type { FeedCache, FeedItem, HubData, HubState } from '../types';

const item: FeedItem = {
	id: 'post-1',
	sourceId: 'reddit',
	title: 'Post comum sem a palavra-chave',
	summary: 'nada relevante',
	url: 'https://example.com/1',
	publishedAt: '2026-11-09T12:00:00Z',
	thumbnail: null
};

const hub: HubData = {
	version: 1,
	settings: { accent: '#8AA4FF' },
	categories: [{ id: 'jogos', name: 'Jogos', color: '#8AA4FF', order: 1 }],
	groups: [],
	items: [],
	feedSources: [
		{
			id: 'reddit',
			type: 'reddit',
			name: 'r/Darktide (patch)',
			target: 'Darktide',
			categoryId: 'jogos',
			intervalMinutes: 30,
			enabled: true,
			include: ['patch'],
			exclude: [],
			matchMode: 'any'
		}
	],
	savedFilters: []
};

const cache: FeedCache = {
	version: 1,
	updatedAt: '2026-11-09T12:00:00Z',
	items: [item],
	sources: {}
};

const state = (saved: string[] = []): HubState => ({ version: 1, read: {}, saved });

describe('buildFeedView', () => {
	it('aplica as regras da fonte no feed normal', () => {
		expect(buildFeedView(hub, cache, state())).toHaveLength(0);
	});

	it('mostra posts salvos mesmo quando não batem com a regra da fonte', () => {
		const view = buildFeedView(hub, cache, state(['post-1']), { savedOnly: true });
		expect(view).toHaveLength(1);
		expect(view[0].saved).toBe(true);
	});

	it('ignora fontes desligadas', () => {
		const disabled = structuredClone(hub);
		disabled.feedSources[0].enabled = false;
		expect(buildFeedView(disabled, cache, state(['post-1']), { savedOnly: true })).toHaveLength(0);
	});

	it('filtra por categoria', () => {
		expect(buildFeedView(hub, cache, state(), { categoryId: 'outra' })).toHaveLength(0);
	});
});
