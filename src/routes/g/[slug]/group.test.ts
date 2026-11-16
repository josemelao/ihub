import { describe, expect, it } from 'vitest';
import { isHttpError } from '@sveltejs/kit';
import type { FeedCache, FeedItem, FeedSource, HubData, HubItem, HubState } from '#lib/types';
import { load } from './+page.server';

const source = (id: string, groupId?: string): FeedSource => ({
	id,
	type: 'rss',
	name: id,
	target: `https://example.com/${id}.xml`,
	categoryId: 'jogos',
	groupId,
	intervalMinutes: 30,
	enabled: true,
	include: [],
	exclude: [],
	matchMode: 'any'
});

const item = (id: string, groupId: string, order: number): HubItem => ({
	id,
	type: 'link',
	name: id,
	url: `https://example.com/${id}`,
	categoryId: 'jogos',
	groupId,
	tags: [],
	pinned: false,
	order
});

const feedItem = (id: string, sourceId: string): FeedItem => ({
	id,
	sourceId,
	title: id,
	summary: '',
	url: `https://example.com/${id}`,
	publishedAt: '2026-01-01T00:00:00.000Z',
	thumbnail: null
});

const hub: HubData = {
	version: 1,
	settings: { accent: '#8AA4FF' },
	categories: [{ id: 'jogos', name: 'Jogos', color: '#8AA4FF', order: 1 }],
	groups: [
		{ id: 'darktide', name: 'Darktide', categoryId: 'jogos', order: 1 },
		{ id: 'outro', name: 'Outro', categoryId: 'jogos', order: 2 }
	],
	items: [item('b', 'darktide', 2), item('a', 'darktide', 1), item('c', 'outro', 1)],
	feedSources: [source('s1', 'darktide'), source('s2', 'darktide'), source('s3')],
	savedFilters: []
};

const feed: FeedCache = {
	version: 1,
	updatedAt: '2026-01-01T00:00:00.000Z',
	items: [feedItem('p1', 's1'), feedItem('p2', 's2'), feedItem('p3', 's3')],
	sources: {}
};

const state: HubState = { version: 1, read: {}, saved: [], savedItems: {} };

type GroupPageData = {
	group: { id: string; name: string };
	category: { name: string };
	items: HubItem[];
	sources: FeedSource[];
	entries: { item: { id: string }; source: FeedSource }[];
};

async function run(slug: string): Promise<GroupPageData> {
	return (await load({
		params: { slug },
		parent: async () => ({ hub, feed, state })
	} as never)) as GroupPageData;
}

describe('/g/[slug] load', () => {
	it('resolve o grupo, ordena itens e limita o feed às fontes do grupo', async () => {
		const data = await run('darktide');

		expect(data.group.name).toBe('Darktide');
		expect(data.category.name).toBe('Jogos');
		expect(data.items.map((entry) => entry.id)).toEqual(['a', 'b']);
		expect(data.sources.map((entry) => entry.id)).toEqual(['s1', 's2']);
		expect(data.entries.map((entry) => entry.item.id)).toEqual(['p1', 'p2']);
	});

	it('devolve 404 amigável para grupo inexistente', async () => {
		try {
			await run('nao-existe');
			throw new Error('deveria falhar');
		} catch (error) {
			expect(isHttpError(error, 404)).toBe(true);
			expect((error as { body: { message: string } }).body.message).toContain('nao-existe');
		}
	});
});
