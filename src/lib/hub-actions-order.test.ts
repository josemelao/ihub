import { describe, expect, it } from 'vitest';
import { EMPTY_HUB } from './defaults';
import { applyHubAction } from './hub-actions';
import type { HubData } from './types';

function hub(): HubData {
	const data = structuredClone(EMPTY_HUB);
	data.categories = [
		{ id: 'c1', name: 'C1', color: '#8AA4FF', order: 1 },
		{ id: 'c2', name: 'C2', color: '#7DD3A8', order: 2 }
	];
	data.groups = [
		{ id: 'g1', name: 'G1', categoryId: 'c1', order: 1 },
		{ id: 'g2', name: 'G2', categoryId: 'c2', order: 1 }
	];
	data.items = [
		{
			id: 'i1',
			type: 'link',
			name: 'I1',
			url: 'https://example.com/1',
			categoryId: 'c1',
			groupId: 'g1',
			tags: [],
			pinned: false,
			order: 1
		},
		{
			id: 'i2',
			type: 'link',
			name: 'I2',
			url: 'https://example.com/2',
			categoryId: 'c2',
			groupId: 'g2',
			tags: [],
			pinned: false,
			order: 1
		}
	];
	data.feedSources = [
		{
			id: 's1',
			type: 'rss',
			name: 'S1',
			target: 'https://example.com/s1.xml',
			categoryId: 'c1',
			intervalMinutes: 30,
			order: 1,
			enabled: true,
			include: [],
			exclude: [],
			matchMode: 'any'
		},
		{
			id: 's2',
			type: 'rss',
			name: 'S2',
			target: 'https://example.com/s2.xml',
			categoryId: 'c1',
			intervalMinutes: 30,
			order: 2,
			enabled: true,
			include: [],
			exclude: [],
			matchMode: 'any'
		}
	];
	return data;
}

describe('move-source action', () => {
	it('swaps sibling sources', () => {
		const moved = applyHubAction(hub(), { action: 'move-source', id: 's2', direction: 'up' });
		expect(moved.feedSources.find((source) => source.id === 's2')?.order).toBe(1);
		expect(moved.feedSources.find((source) => source.id === 's1')?.order).toBe(2);
	});
});

describe('move-item-to action', () => {
	it('moves an item to another category and group', () => {
		const moved = applyHubAction(hub(), {
			action: 'move-item-to',
			id: 'i1',
			categoryId: 'c2',
			groupId: 'g2'
		});
		const item = moved.items.find((entry) => entry.id === 'i1');

		expect(item).toMatchObject({ categoryId: 'c2', groupId: 'g2', order: 2 });
	});

	it('removes the group when groupId is null', () => {
		const moved = applyHubAction(hub(), {
			action: 'move-item-to',
			id: 'i2',
			categoryId: 'c2',
			groupId: null
		});
		const item = moved.items.find((entry) => entry.id === 'i2');

		expect(item?.groupId).toBeUndefined();
		expect(item?.order).toBe(1);
	});

	it('rejects a group from another category', () => {
		expect(() =>
			applyHubAction(hub(), {
				action: 'move-item-to',
				id: 'i1',
				categoryId: 'c1',
				groupId: 'g2'
			})
		).toThrow(/grupo/i);
	});

	it('rejects an unknown category', () => {
		expect(() =>
			applyHubAction(hub(), {
				action: 'move-item-to',
				id: 'i1',
				categoryId: 'nope',
				groupId: null
			})
		).toThrow(/categoria/i);
	});
});
