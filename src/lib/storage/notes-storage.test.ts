import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonFileStorage } from './json-file';
import { EMPTY_HUB } from '../defaults';
import { upsertNote } from '../notes';
import { HubValidationError } from '../schema';
import type { NotesData } from '../types';

let dir: string;
let storage: JsonFileStorage;

const notes = (): NotesData => ({
	version: 1,
	notes: [
		{
			id: 'rapida',
			text: 'lembrar',
			createdAt: '2026-01-01T00:00:00.000Z',
			updatedAt: '2026-01-01T00:00:00.000Z'
		}
	]
});

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), 'meu-hub-notes-'));
	storage = new JsonFileStorage(dir);
	await storage.saveHub(EMPTY_HUB);
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe('notes no storage', () => {
	it('grava e lê de volta', async () => {
		await storage.saveNotes(notes());

		expect(await storage.loadNotes()).toEqual(notes());
	});

	it('devolve vazio quando o arquivo não existe', async () => {
		expect(await storage.loadNotes()).toEqual({ version: 1, notes: [] });
	});

	it('cria .bak na segunda gravação', async () => {
		await storage.saveNotes(notes());
		await storage.saveNotes({ version: 1, notes: [] });

		const backup = JSON.parse(await readFile(join(dir, 'notes.json.bak'), 'utf8')) as NotesData;
		expect(backup.notes[0].text).toBe('lembrar');
	});

	it('updateNotes aplica a mudança sob lock', async () => {
		const result = await storage.updateNotes((current) =>
			upsertNote(current, { text: 'nova nota' }, '2026-02-02T00:00:00.000Z')
		);

		expect(result.notes[0].text).toBe('nova nota');
		expect((await storage.loadNotes()).notes[0].text).toBe('nova nota');
	});

	it('inclui as notas no export', async () => {
		await storage.saveNotes(notes());

		const bundle = await storage.exportBundle();

		expect(bundle.notes?.notes[0].text).toBe('lembrar');
	});

	it('importa as notas no modo replace', async () => {
		await storage.importBundle({ hub: EMPTY_HUB, notes: notes() }, 'replace');

		expect((await storage.loadNotes()).notes[0].text).toBe('lembrar');
	});

	it('mescla notas por id no modo merge', async () => {
		await storage.saveNotes(notes());
		const incoming = notes();
		incoming.notes[0].text = 'atualizada';
		incoming.notes.push({
			id: 'outra',
			text: 'segunda',
			createdAt: '2026-03-03T00:00:00.000Z',
			updatedAt: '2026-03-03T00:00:00.000Z'
		});

		await storage.importBundle({ hub: EMPTY_HUB, notes: incoming }, 'merge');
		const stored = await storage.loadNotes();

		expect(stored.notes.map((note) => note.text).sort()).toEqual(['atualizada', 'segunda']);
	});

	it('recusa notas inválidas antes de tocar no hub', async () => {
		await expect(
			storage.importBundle(
				{ hub: EMPTY_HUB, notes: { version: 1, notes: [{ id: '', text: '' }] } as NotesData },
				'replace'
			)
		).rejects.toThrow(HubValidationError);

		expect((await storage.loadHub()).categories).toEqual([]);
	});
});
