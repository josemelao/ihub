import { describe, expect, it } from 'vitest';
import { EMPTY_HUB } from './defaults';
import { applyHubAction } from './hub-actions';
import type { HubData } from './types';

function base(): HubData {
	const hub = structuredClone(EMPTY_HUB);
	hub.categories = [{ id: 'c', name: 'C', color: '#8AA4FF', order: 1 }];
	hub.items = [
		{
			id: 'a',
			type: 'link',
			name: 'A',
			url: 'https://a.example.com',
			categoryId: 'c',
			tags: ['build', 'Build', 'Trabalho'],
			pinned: false,
			order: 1
		}
	];
	return hub;
}

describe('rename-tag action', () => {
	it('renames the tag on every item', () => {
		const renamed = applyHubAction(base(), {
			action: 'rename-tag',
			from: 'build',
			to: 'Build final'
		});
		expect(renamed.items[0].tags).toEqual(['Build final', 'Trabalho']);
	});

	it('merges with an existing destination', () => {
		const renamed = applyHubAction(base(), {
			action: 'rename-tag',
			from: 'build',
			to: 'Trabalho'
		});
		expect(renamed.items[0].tags).toEqual(['Trabalho']);
	});

	it('rejects missing fields or an empty destination', () => {
		expect(() => applyHubAction(base(), { action: 'rename-tag', to: 'X' })).toThrow(/tag/i);
		expect(() => applyHubAction(base(), { action: 'rename-tag', from: 'build' })).toThrow(/tag/i);
		expect(() =>
			applyHubAction(base(), { action: 'rename-tag', from: 'build', to: '   ' })
		).toThrow(/nome/i);
	});
});

describe('remove-tag action', () => {
	it('removes the tag from every item', () => {
		const removed = applyHubAction(base(), { action: 'remove-tag', tag: 'BUILD' });
		expect(removed.items[0].tags).toEqual(['Trabalho']);
	});

	it('rejects a missing tag', () => {
		expect(() => applyHubAction(base(), { action: 'remove-tag' })).toThrow(/tag/i);
	});
});
