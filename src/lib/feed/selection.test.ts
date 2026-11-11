import { describe, expect, it } from 'vitest';
import { pruneSelection, selectAll, updateSelection } from './selection';

const visibleIds = ['a', 'b', 'c', 'd', 'e'];

describe('updateSelection', () => {
	it('alterna um item e move a âncora', () => {
		const added = updateSelection([], 'b', {
			visibleIds,
			anchor: null,
			mode: 'toggle'
		});
		expect(added.selected).toEqual(['b']);
		expect(added.anchor).toBe('b');

		const removed = updateSelection(added.selected, 'b', {
			visibleIds,
			anchor: added.anchor,
			mode: 'toggle'
		});
		expect(removed.selected).toEqual([]);
	});

	it('seleciona o intervalo com shift, inclusive', () => {
		const result = updateSelection(['b'], 'd', {
			visibleIds,
			anchor: 'b',
			mode: 'range'
		});

		expect(result.selected).toEqual(['b', 'c', 'd']);
		expect(result.anchor).toBe('b');
	});

	it('mantém itens fora do intervalo ao estender', () => {
		const result = updateSelection(['a', 'c'], 'e', {
			visibleIds,
			anchor: 'c',
			mode: 'range'
		});

		expect(result.selected).toEqual(['a', 'c', 'd', 'e']);
	});

	it('shift sem âncora vira toggle', () => {
		const result = updateSelection([], 'c', {
			visibleIds,
			anchor: null,
			mode: 'range'
		});

		expect(result.selected).toEqual(['c']);
		expect(result.anchor).toBe('c');
	});

	it('selecionar todos devolve ids únicos', () => {
		expect(selectAll(['a', 'a', 'b'])).toEqual(['a', 'b']);
	});
});

describe('pruneSelection', () => {
	it('remove ids que não estão mais visíveis', () => {
		expect(pruneSelection(['a', 'x', 'c'], ['a', 'b', 'c'])).toEqual(['a', 'c']);
	});
});
