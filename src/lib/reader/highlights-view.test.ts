import { describe, expect, it } from 'vitest';
import {
	countByColor,
	filterHighlights,
	groupHighlights,
	totalHighlights
} from './highlights-view';
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

describe('filterHighlights', () => {
	const groups = groupHighlights([
		{ ...h('1', 'a', 'Patch', '2026-01-01T00:00:00.000Z'), quote: 'dano do Flamethrower' },
		{
			...h('2', 'a', 'Patch', '2026-01-02T00:00:00.000Z'),
			quote: 'economia',
			color: 'blue',
			note: 'revisar depois'
		},
		{ ...h('3', 'b', 'Guia', '2026-01-03T00:00:00.000Z'), quote: 'build de ogryn' }
	]);

	it('sem filtro devolve os mesmos grupos', () => {
		expect(filterHighlights(groups, {})).toBe(groups);
	});

	it('filtra por busca sem acento e mantém o grupo', () => {
		const filtered = filterHighlights(groups, { query: 'flamethrower' });
		expect(filtered).toHaveLength(1);
		expect(totalHighlights(filtered)).toBe(1);
	});

	it('busca também na nota', () => {
		const filtered = filterHighlights(groups, { query: 'revisar' });
		expect(totalHighlights(filtered)).toBe(1);
		expect(filtered[0].highlights[0].id).toBe('2');
	});

	it('filtra por cor e remove grupos vazios', () => {
		const filtered = filterHighlights(groups, { color: 'blue' });
		expect(filtered).toHaveLength(1);
		expect(filtered[0].itemId).toBe('a');
		expect(filtered[0].highlights.map((highlight) => highlight.id)).toEqual(['2']);
	});

	it('combina busca e cor', () => {
		expect(filterHighlights(groups, { query: 'economia', color: 'yellow' })).toHaveLength(0);
		expect(filterHighlights(groups, { query: 'economia', color: 'blue' })).toHaveLength(1);
	});

	it('conta por cor', () => {
		const all = countByColor(groups.flatMap((group) => group.highlights));
		expect(all).toEqual({ all: 3, yellow: 2, green: 0, blue: 1, pink: 0 });
	});
});
