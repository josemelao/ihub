import { describe, expect, it } from 'vitest';
import { groupHighlights, totalHighlights } from './highlights-view';
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

	it('ordena grupos pelo updatedAt mais recente, não pelo createdAt', () => {
		const a = {
			...h('1', 'a', 'A', '2026-01-01T00:00:00.000Z'),
			updatedAt: '2026-01-09T00:00:00.000Z'
		};
		const b = h('2', 'b', 'B', '2026-01-02T00:00:00.000Z');

		expect(groupHighlights([a, b]).map((group) => group.itemId)).toEqual(['a', 'b']);
	});

	it('conta o total de trechos, não de posts', () => {
		const groups = groupHighlights([
			h('1', 'a', 'A', '2026-01-01T00:00:00.000Z'),
			h('2', 'a', 'A', '2026-01-02T00:00:00.000Z'),
			h('3', 'b', 'B', '2026-01-03T00:00:00.000Z')
		]);

		expect(totalHighlights(groups)).toBe(3);
	});
});
