import { describe, expect, it } from 'vitest';
import { addHighlight, HighlightError, removeHighlight, updateHighlight } from './highlights';
import { EMPTY_HIGHLIGHTS } from '../defaults';

const input = {
	itemId: 'abc',
	itemTitle: 'Post',
	itemUrl: 'https://e.com/a',
	quote: 'trecho',
	color: 'green' as const,
	occurrence: 1
};

describe('destaques', () => {
	it('adiciona com id determinístico e normaliza espaços', () => {
		const data = addHighlight(EMPTY_HIGHLIGHTS, { ...input, quote: '  trecho  ' });

		expect(data.highlights[0].quote).toBe('trecho');
		expect(data.highlights[0].id).toMatch(/^hl-[a-f0-9]{16}$/);
	});

	it('re-adicionar mesmo trecho/ocorrência atualiza em vez de duplicar', () => {
		const first = addHighlight(EMPTY_HIGHLIGHTS, input);
		const second = addHighlight(first, { ...input, color: 'blue' });

		expect(second.highlights).toHaveLength(1);
		expect(second.highlights[0].color).toBe('blue');
	});

	it('rejeita quote vazia, longa e cor inválida', () => {
		expect(() => addHighlight(EMPTY_HIGHLIGHTS, { ...input, quote: '  ' })).toThrow(HighlightError);
		expect(() => addHighlight(EMPTY_HIGHLIGHTS, { ...input, quote: 'x'.repeat(2001) })).toThrow(
			HighlightError
		);
		expect(() => addHighlight(EMPTY_HIGHLIGHTS, { ...input, color: 'roxo' as never })).toThrow(
			HighlightError
		);
	});

	it('rejeita nota acima de 2.000 caracteres', () => {
		expect(() => addHighlight(EMPTY_HIGHLIGHTS, { ...input, note: 'x'.repeat(2001) })).toThrow(
			HighlightError
		);
	});

	it('atualiza nota e remove', () => {
		const data = addHighlight(EMPTY_HIGHLIGHTS, input);
		const id = data.highlights[0].id;

		const updated = updateHighlight(data, id, { note: 'lembrar' });
		expect(updated.highlights[0].note).toBe('lembrar');
		expect(updateHighlight(data, id, { note: null }).highlights[0].note).toBeUndefined();
		expect(removeHighlight(updated, id).highlights).toEqual([]);
	});

	it('lança not-found ao atualizar id inexistente', () => {
		expect(() => updateHighlight(EMPTY_HIGHLIGHTS, 'hl-x', { note: 'x' })).toThrow(HighlightError);
	});
});
