import { describe, expect, it } from 'vitest';
import { EMPTY_HUB } from './defaults';
import type { FeedSource, HubData } from './types';
import { addSources, moveSource, updateGroup, updateSource } from './hub-edit';

function source(id: string, categoryId: string, order: number): FeedSource {
	return {
		id,
		type: 'rss',
		name: id,
		target: `https://example.com/${id}.xml`,
		categoryId,
		intervalMinutes: 30,
		order,
		enabled: true,
		include: [],
		exclude: [],
		matchMode: 'any'
	};
}

function base(): HubData {
	const hub = structuredClone(EMPTY_HUB);
	hub.categories = [
		{ id: 'c1', name: 'C1', color: '#8AA4FF', order: 1 },
		{ id: 'c2', name: 'C2', color: '#7DD3A8', order: 2 }
	];
	hub.feedSources = [source('s1', 'c1', 1), source('s2', 'c1', 2), source('s3', 'c2', 1)];
	return hub;
}

function input(name: string, categoryId: string) {
	return {
		type: 'rss' as const,
		name,
		target: `https://example.com/${name}.xml`,
		categoryId,
		intervalMinutes: 30,
		enabled: true,
		include: [],
		exclude: [],
		matchMode: 'any' as const
	};
}

describe('addSources order', () => {
	it('appends new sources to the end of their own category', () => {
		const hub = addSources(base(), [input('a', 'c1'), input('b', 'c2'), input('c', 'c1')]);
		const orders = Object.fromEntries(hub.feedSources.map((entry) => [entry.name, entry.order]));

		expect(orders).toEqual({ s1: 1, s2: 2, s3: 1, a: 3, b: 2, c: 4 });
	});
});

describe('moveSource', () => {
	it('swaps a source with its previous sibling', () => {
		const moved = moveSource(base(), 's2', 'up');
		const orders = Object.fromEntries(moved.feedSources.map((entry) => [entry.id, entry.order]));

		expect(orders).toEqual({ s1: 2, s2: 1, s3: 1 });
	});

	it('swaps a source with its next sibling', () => {
		const moved = moveSource(base(), 's1', 'down');
		const orders = Object.fromEntries(moved.feedSources.map((entry) => [entry.id, entry.order]));

		expect(orders).toEqual({ s1: 2, s2: 1, s3: 1 });
	});

	it('does nothing at the edges or across categories', () => {
		expect(moveSource(base(), 's1', 'up').feedSources).toEqual(base().feedSources);
		expect(moveSource(base(), 's2', 'down').feedSources).toEqual(base().feedSources);
		expect(moveSource(base(), 's3', 'down').feedSources).toEqual(base().feedSources);
	});

	it('normalizes legacy sources without order', () => {
		const hub = base();
		delete hub.feedSources[0].order;
		const moved = moveSource(hub, 's2', 'up');

		expect(moved.feedSources.every((entry) => typeof entry.order === 'number')).toBe(true);
		expect(moved.feedSources.find((entry) => entry.id === 's2')?.order).toBe(1);
	});
});

describe('source order on category change', () => {
	it('appends a source when updateSource changes its category', () => {
		const moved = updateSource(base(), 's1', { categoryId: 'c2' });
		const source = moved.feedSources.find((entry) => entry.id === 's1');

		expect(source).toMatchObject({ categoryId: 'c2', order: 2 });
	});

	it('appends moved sources when updateGroup changes category', () => {
		const hub = base();
		hub.groups = [{ id: 'g1', name: 'G1', categoryId: 'c1', order: 1 }];
		hub.feedSources[0] = { ...hub.feedSources[0], groupId: 'g1' };

		const moved = updateGroup(hub, 'g1', { categoryId: 'c2' });
		const source = moved.feedSources.find((entry) => entry.id === 's1');

		expect(source).toMatchObject({ categoryId: 'c2', order: 2 });
	});
});
