import { describe, it, expect } from 'vitest';
import { backfillSavedSnapshots, buildFeedView, buildSavedView } from './view';
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

const state = (saved: string[] = []): HubState => ({
	version: 1,
	read: {},
	saved,
	savedItems: {}
});

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

describe('buildSavedView', () => {
	it('inclui posts salvos que ainda estão no cache', () => {
		const view = buildSavedView(hub, cache, state(['post-1']));
		expect(view).toHaveLength(1);
		expect(view[0].saved).toBe(true);
	});

	it('usa o snapshot quando a fonte/cache não existe mais', () => {
		const snapshotState = state(['sumiu']);
		snapshotState.savedItems.sumiu = {
			item: {
				...item,
				id: 'sumiu',
				sourceId: 'fonte-removida',
				title: 'Post antigo salvo',
				publishedAt: '2026-11-08T10:00:00Z'
			},
			sourceId: 'fonte-removida',
			sourceName: 'Fonte removida',
			categoryId: 'categoria-sumiu',
			categoryName: 'Jogos',
			color: '#123456',
			savedAt: '2026-11-09T12:00:00Z'
		};

		const view = buildSavedView(hub, cache, snapshotState);
		expect(view).toHaveLength(1);
		expect(view[0].source.name).toBe('Fonte removida');
		expect(view[0].category?.color).toBe('#123456');
	});

	it('ignora id salvo sem cache e sem snapshot', () => {
		expect(buildSavedView(hub, cache, state(['fantasma']))).toHaveLength(0);
	});

	it('mantém salvo mesmo com a fonte desligada', () => {
		const disabled = structuredClone(hub);
		disabled.feedSources[0].enabled = false;
		expect(buildSavedView(disabled, cache, state(['post-1']))).toHaveLength(1);
	});
});

describe('backfillSavedSnapshots', () => {
	it('cria snapshot para salvo antigo que ainda está no cache', () => {
		const original = state(['post-1']);
		const filled = backfillSavedSnapshots(hub, cache, original);
		expect(filled.savedItems['post-1'].sourceName).toBe('r/Darktide (patch)');
		expect(filled).not.toBe(original);
	});

	it('não altera o estado quando não há item para snapshot', () => {
		const original = state(['fantasma']);
		expect(backfillSavedSnapshots(hub, cache, original)).toBe(original);
	});
});
