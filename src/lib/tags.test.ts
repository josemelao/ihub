import { describe, expect, it } from 'vitest';
import { EMPTY_HUB } from './defaults';
import { addLink, updateItem } from './hub-edit';
import { parseHub } from './schema';
import type { HubData } from './types';
import { collectTags, itemHasTag, normalizeTags, removeTag, renameTag, tagKey } from './tags';

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
			tags: ['Build', 'build', ' Pré venda '],
			pinned: false,
			order: 1
		},
		{
			id: 'b',
			type: 'link',
			name: 'B',
			url: 'https://b.example.com',
			categoryId: 'c',
			tags: ['build', 'Trabalho'],
			pinned: false,
			order: 2
		},
		{
			id: 'c',
			type: 'app',
			name: 'C',
			launch: { kind: 'protocol', value: 'steam://run/1' },
			categoryId: 'c',
			tags: [],
			pinned: false,
			order: 3
		}
	];
	return hub;
}

describe('normalizeTags', () => {
	it('removes empty duplicates by case, accent and spaces', () => {
		expect(
			normalizeTags([' Build ', 'build', 'BUILD', 'Pré venda', 'pre venda', '', '  '])
		).toEqual(['Build', 'Pré venda']);
	});

	it('keeps the first spelling', () => {
		expect(normalizeTags(['  Reddit ', 'reddit'])).toEqual(['Reddit']);
	});
});

describe('tagKey', () => {
	it('ignores case, accents and extra spaces', () => {
		expect(tagKey('  Pré   Venda ')).toBe('pre venda');
	});
});

describe('collectTags', () => {
	it('counts items per normalized tag', () => {
		expect(collectTags(base()).map(({ tag, count }) => ({ tag, count }))).toEqual([
			{ tag: 'Build', count: 2 },
			{ tag: 'Pré venda', count: 1 },
			{ tag: 'Trabalho', count: 1 }
		]);
	});

	it('returns an empty list when there are no tags', () => {
		const hub = base();
		hub.items = [];
		expect(collectTags(hub)).toEqual([]);
	});
});

describe('itemHasTag', () => {
	it('matches by normalized key', () => {
		expect(itemHasTag(base().items[0], 'BUILD')).toBe(true);
		expect(itemHasTag(base().items[0], 'pre venda')).toBe(true);
		expect(itemHasTag(base().items[2], 'build')).toBe(false);
	});
});

describe('renameTag', () => {
	it('updates every item and merges with an existing destination', () => {
		const renamed = renameTag(base(), 'build', 'Build final');
		expect(renamed.items[0].tags).toEqual(['Build final', 'Pré venda']);
		expect(renamed.items[1].tags).toEqual(['Build final', 'Trabalho']);
	});

	it('does not duplicate when the destination already exists', () => {
		const renamed = renameTag(base(), 'build', 'Trabalho');
		expect(renamed.items[0].tags).toEqual(['Trabalho', 'Pré venda']);
		expect(renamed.items[1].tags).toEqual(['Trabalho']);
	});

	it('rejects an empty destination', () => {
		expect(() => renameTag(base(), 'build', '   ')).toThrow(/nome/i);
	});
});

describe('removeTag', () => {
	it('removes the tag from every item without deleting the items', () => {
		const removed = removeTag(base(), 'BUILD');
		expect(removed.items).toHaveLength(3);
		expect(removed.items[0].tags).toEqual(['Pré venda']);
		expect(removed.items[1].tags).toEqual(['Trabalho']);
	});

	it('is a no-op for an unknown or empty tag', () => {
		expect(removeTag(base(), 'inexistente').items).toEqual(base().items);
		expect(removeTag(base(), '  ').items).toEqual(base().items);
	});
});

describe('normalização na gravação', () => {
	it('parseHub normalizes tags loaded from disk', () => {
		const parsed = parseHub(base());
		expect(parsed.items[0].tags).toEqual(['Build', 'Pré venda']);
	});

	it('addLink normalizes tags from the editor', () => {
		const hub = addLink(base(), {
			name: 'Novo',
			url: 'https://novo.example.com',
			categoryId: 'c',
			tags: [' build ', 'BUILD', 'Novo']
		});
		expect(hub.items.at(-1)?.tags).toEqual(['build', 'Novo']);
	});

	it('updateItem normalizes edited tags', () => {
		const hub = updateItem(base(), 'b', { tags: [' trabalho ', 'TRABALHO'] });
		expect(hub.items[1].tags).toEqual(['trabalho']);
	});
});
