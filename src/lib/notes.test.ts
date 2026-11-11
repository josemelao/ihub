import { describe, expect, it } from 'vitest';
import { EMPTY_NOTES } from './defaults';
import { MAX_NOTE_LENGTH, QUICK_NOTE_ID, quickNoteOf, removeNote, upsertNote } from './notes';
import type { HubNote } from './types';

const note = (id: string, text: string): HubNote => ({
	id,
	text,
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z'
});

describe('upsertNote', () => {
	it('cria uma nota nova com timestamps', () => {
		const result = upsertNote(EMPTY_NOTES, { text: 'ideia' }, '2026-02-02T00:00:00.000Z');

		expect(result.notes).toHaveLength(1);
		expect(result.notes[0]).toMatchObject({
			text: 'ideia',
			createdAt: '2026-02-02T00:00:00.000Z',
			updatedAt: '2026-02-02T00:00:00.000Z'
		});
	});

	it('atualiza o texto preservando createdAt', () => {
		const start = { ...EMPTY_NOTES, notes: [note('a', 'antiga')] };
		const result = upsertNote(start, { id: 'a', text: 'nova' }, '2026-03-03T00:00:00.000Z');

		expect(result.notes[0]).toMatchObject({
			id: 'a',
			text: 'nova',
			createdAt: '2026-01-01T00:00:00.000Z',
			updatedAt: '2026-03-03T00:00:00.000Z'
		});
	});

	it('apara espaços e recusa texto vazio', () => {
		expect(upsertNote(EMPTY_NOTES, { text: '  oi  ' }).notes[0].text).toBe('oi');
		expect(() => upsertNote(EMPTY_NOTES, { text: '   ' })).toThrow(/vazia/i);
	});

	it('limita o tamanho do texto', () => {
		const long = 'x'.repeat(MAX_NOTE_LENGTH + 50);
		expect(upsertNote(EMPTY_NOTES, { text: long }).notes[0].text).toHaveLength(MAX_NOTE_LENGTH);
	});

	it('não muta o estado original', () => {
		const start = { ...EMPTY_NOTES, notes: [note('a', 'antiga')] };
		upsertNote(start, { id: 'a', text: 'nova' });
		expect(start.notes[0].text).toBe('antiga');
	});
});

describe('removeNote', () => {
	it('remove só a nota indicada', () => {
		const start = { ...EMPTY_NOTES, notes: [note('a', 'a'), note('b', 'b')] };
		const result = removeNote(start, 'a');

		expect(result.notes.map((entry) => entry.id)).toEqual(['b']);
	});

	it('ignora id inexistente', () => {
		const start = { ...EMPTY_NOTES, notes: [note('a', 'a')] };
		expect(removeNote(start, 'zzz')).toEqual(start);
	});
});

describe('quickNoteOf', () => {
	it('devolve a nota rápida quando existe', () => {
		const start = { ...EMPTY_NOTES, notes: [note(QUICK_NOTE_ID, 'lembrar')] };
		expect(quickNoteOf(start)?.text).toBe('lembrar');
	});

	it('devolve null quando não existe', () => {
		expect(quickNoteOf(EMPTY_NOTES)).toBeNull();
	});
});
