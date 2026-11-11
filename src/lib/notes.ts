import { EMPTY_NOTES } from './defaults';
import type { HubNote, NotesData } from './types';

export const MAX_NOTE_LENGTH = 4000;
export const QUICK_NOTE_ID = 'rapida';

export interface NoteInput {
	id?: string;
	text: string;
	pinned?: boolean;
}

function nowIso(): string {
	return new Date().toISOString();
}

/** Cria ou atualiza uma nota. Texto vazio é rejeitado (para remover, use `removeNote`). */
export function upsertNote(data: NotesData, input: NoteInput, at: string = nowIso()): NotesData {
	const text = input.text.trim().slice(0, MAX_NOTE_LENGTH);
	if (!text) throw new Error('A nota não pode ficar vazia.');

	const id = input.id?.trim() || QUICK_NOTE_ID;
	const existing = data.notes.find((note) => note.id === id);
	const note: HubNote = existing
		? {
				...existing,
				text,
				updatedAt: at,
				...(input.pinned !== undefined ? { pinned: input.pinned } : {})
			}
		: { id, text, createdAt: at, updatedAt: at, ...(input.pinned ? { pinned: true } : {}) };

	return {
		...data,
		notes: existing
			? data.notes.map((entry) => (entry.id === id ? note : entry))
			: [...data.notes, note]
	};
}

export function removeNote(data: NotesData, id: string): NotesData {
	const notes = data.notes.filter((note) => note.id !== id);
	return notes.length === data.notes.length ? data : { ...data, notes };
}

export function quickNoteOf(data: NotesData): HubNote | null {
	return data.notes.find((note) => note.id === QUICK_NOTE_ID) ?? null;
}

export function notesOf(data: NotesData): HubNote[] {
	return [...data.notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export { EMPTY_NOTES };
