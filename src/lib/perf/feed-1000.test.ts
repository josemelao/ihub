import { describe, expect, it } from 'vitest';
import { matchesFilter } from '../feed/filter';
import { buildFeedView, buildSavedView } from '../feed/view';
import { searchHub, searchIndexFor } from '../search';
import type { FeedCache, FeedItem, FeedSource, HubData, HubState } from '../types';

const SOURCE_COUNT = 10;
const POSTS_PER_SOURCE = 100;
const TOTAL = SOURCE_COUNT * POSTS_PER_SOURCE;

function fixture(): { hub: HubData; feed: FeedCache; state: HubState } {
	const sources: FeedSource[] = Array.from({ length: SOURCE_COUNT }, (_, index) => ({
		id: `fonte-${index}`,
		type: 'rss',
		name: `Fonte ${index}`,
		target: `https://example.com/feed-${index}.xml`,
		categoryId: 'cat',
		intervalMinutes: 30,
		maxItems: POSTS_PER_SOURCE,
		enabled: true,
		include: [],
		exclude: [],
		matchMode: 'any'
	}));

	const items: FeedItem[] = [];
	for (let source = 0; source < SOURCE_COUNT; source += 1) {
		for (let post = 0; post < POSTS_PER_SOURCE; post += 1) {
			const index = source * POSTS_PER_SOURCE + post;
			items.push({
				id: `post-${index}`,
				sourceId: `fonte-${source}`,
				title: `Notícia ${index} sobre tecnologia e jogos`,
				summary: `Resumo do post ${index} com palavras suficientes para a busca e o filtro.`,
				url: `https://example.com/post/${index}`,
				publishedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
				thumbnail: null
			});
		}
	}

	const hub: HubData = {
		version: 1,
		settings: { accent: '#8AA4FF' },
		categories: [{ id: 'cat', name: 'Categoria', color: '#8AA4FF', order: 1 }],
		groups: [],
		items: Array.from({ length: 30 }, (_, index) => ({
			id: `link-${index}`,
			type: 'link' as const,
			name: `Link ${index}`,
			url: `https://example.com/link/${index}`,
			categoryId: 'cat',
			tags: [],
			pinned: false,
			order: index
		})),
		feedSources: sources,
		savedFilters: []
	};

	const state: HubState = {
		version: 1,
		read: Object.fromEntries(
			items.slice(0, 300).map((item) => [item.id, '2026-01-02T00:00:00.000Z'])
		),
		saved: items.slice(300, 330).map((item) => item.id),
		savedItems: {}
	};

	return {
		hub,
		feed: { version: 1, updatedAt: '2026-01-02T00:00:00.000Z', items, sources: {} },
		state
	};
}

function median(run: () => void, runs = 5): number {
	run();
	const samples: number[] = [];
	for (let index = 0; index < runs; index += 1) {
		const start = performance.now();
		run();
		samples.push(performance.now() - start);
	}
	samples.sort((a, b) => a - b);
	return samples[Math.floor(samples.length / 2)];
}

function report(name: string, value: number, budget: number): void {
	if (process.env.PERF_LOG) {
		console.log(`${name}: ${value.toFixed(1)} ms (orçamento ${budget} ms)`);
	}
}

describe('performance com 1.000 posts', () => {
	it('monta a visão completa dentro do orçamento', () => {
		const { hub, feed, state } = fixture();
		const view = buildFeedView(hub, feed, state);
		expect(view).toHaveLength(TOTAL);

		const time = median(() => buildFeedView(hub, feed, state));
		report('buildFeedView', time, 150);
		expect(time).toBeLessThan(150);
	});

	it('filtra os 1.000 posts por termos sem travar', () => {
		const { hub, feed, state } = fixture();
		const view = buildFeedView(hub, feed, state);

		const time = median(() => {
			view.filter((entry) =>
				matchesFilter(`${entry.item.title}\n${entry.item.summary}`, ['jogos'], ['esporte'], 'any')
			);
		});
		report('filtro de 1.000', time, 50);
		expect(time).toBeLessThan(50);
	});

	it('constrói o índice de busca e consulta dentro do orçamento', () => {
		const { hub, feed } = fixture();
		const build = median(() => {
			const fresh = structuredClone(hub);
			searchIndexFor(fresh, feed);
		});
		report('índice de busca', build, 400);
		expect(build).toBeLessThan(400);

		const query = median(() => searchHub(hub, 'tecnologia', 20, feed));
		report('consulta Fuse', query, 50);
		expect(query).toBeLessThan(50);
		expect(searchHub(hub, 'tecnologia', 20, feed).length).toBeGreaterThan(0);
	});

	it('monta a visão de salvos e mantém o payload do cache abaixo de 2 MB', () => {
		const { hub, feed, state } = fixture();
		const saved = median(() => buildSavedView(hub, feed, state));
		report('buildSavedView', saved, 50);
		expect(saved).toBeLessThan(50);

		const bytes = new TextEncoder().encode(JSON.stringify(feed)).length;
		if (process.env.PERF_LOG) console.log(`feed-cache de 1.000: ${(bytes / 1024).toFixed(0)} KB`);
		expect(bytes).toBeLessThan(2 * 1024 * 1024);
	});
});
