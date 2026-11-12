import { describe, expect, it } from 'vitest';
import { groupHighlights } from './highlights-view';
import type { ReadingHighlight } from '../types';

const h = (id: string, itemId: string, itemTitle: string, at: string): ReadingHighlight => ({
	id,
	itemId,
	itemTitle,
	itemUrl: 'https://e.com/a',
	quote: 'q',
	color: 'yellow',
	occurrence: 0,
	createdAt: at,
	updatedAt: at
});

describe('groupHighlights', () => {
	it('agrupa por item e ordena grupos pelo mais recente', () => {
		const groups = groupHighlights([
			h('1', 'a', 'A', '2026-01-01T00:00:00.000Z'),
			h('2', 'b', 'B', '2026-01-02T00:00:00.000Z'),
			h('3', 'a', 'A', '2026-01-03T00:00:00.000Z')
		]);

		expect(groups.map((group) => group.itemId)).toEqual(['a', 'b']);
		expect(groups[0].highlights.map((highlight) => highlight.id)).toEqual(['1', '3']);
	});
});
