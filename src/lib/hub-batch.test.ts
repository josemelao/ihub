import { describe, expect, it } from 'vitest';
import { EMPTY_HUB } from './defaults';
import { addLinks, addSources } from './hub-edit';

function base() {
	const hub = structuredClone(EMPTY_HUB);
	hub.categories = [{ id: 'c', name: 'C', color: '#8AA4FF', order: 1 }];
	hub.groups = [{ id: 'g', name: 'G', categoryId: 'c', order: 1 }];
	hub.items = [
		{
			id: 'old',
			type: 'link',
			name: 'Old',
			url: 'https://old.example.com',
			categoryId: 'c',
			groupId: 'g',
			tags: [],
			pinned: false,
			order: 5
		}
	];
	return hub;
}

describe('addLinks', () => {
	it('adds many links with unique ids and sequential orders', () => {
		const hub = addLinks(base(), [
			{ name: 'A', url: 'https://a.example.com', categoryId: 'c', groupId: 'g' },
			{ name: 'A', url: 'https://b.example.com', categoryId: 'c', groupId: 'g' },
			{ name: 'C', url: 'https://c.example.com', categoryId: 'c' }
		]);

		expect(hub.items).toHaveLength(4);
		expect(new Set(hub.items.map((item) => item.id)).size).toBe(4);
		const inGroup = hub.items
			.filter((item) => item.groupId === 'g')
			.sort((a, b) => a.order - b.order);
		expect(inGroup.map((item) => item.order)).toEqual([5, 6, 7]);
		expect(hub.items.find((item) => item.name === 'C')?.order).toBe(1);
	});
});

describe('addSources', () => {
	it('adds many sources with unique ids', () => {
		const hub = addSources(base(), [
			{
				type: 'rss',
				name: 'Feed',
				target: 'https://a.example.com/feed.xml',
				categoryId: 'c',
				intervalMinutes: 30,
				enabled: true,
				include: [],
				exclude: [],
				matchMode: 'any'
			},
			{
				type: 'rss',
				name: 'Feed',
				target: 'https://b.example.com/feed.xml',
				categoryId: 'c',
				intervalMinutes: 30,
				enabled: true,
				include: [],
				exclude: [],
				matchMode: 'any'
			}
		]);

		expect(hub.feedSources.map((source) => source.id)).toEqual(['feed', 'feed-2']);
	});
});
