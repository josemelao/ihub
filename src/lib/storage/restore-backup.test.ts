import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonFileStorage } from './json-file';
import type { FeedCache, HighlightsData, HubData, HubState, NotesData } from '../types';

const hub = (name: string): HubData => ({
	version: 1,
	settings: { accent: '#8AA4FF' },
	categories: [{ id: 'jogos', name, color: '#8AA4FF', order: 1 }],
	groups: [],
	items: [],
	feedSources: [],
	savedFilters: []
});

const state = (mark: string): HubState => ({
	version: 1,
	read: { [mark]: '2026-01-01T00:00:00.000Z' },
	saved: [],
	savedItems: {}
});

const cache: FeedCache = {
	version: 1,
	updatedAt: '2026-01-01T00:00:00.000Z',
	items: [],
	sources: {}
};

const notes = (text: string): NotesData => ({
	version: 1,
	notes: [
		{
			id: 'nota-1',
			text,
			createdAt: '2026-01-01T00:00:00.000Z',
			updatedAt: '2026-01-01T00:00:00.000Z'
		}
	]
});

const highlights = (quote: string): HighlightsData => ({
	version: 1,
	highlights: [
		{
			id: 'hl-1',
			itemId: 'post-1',
			itemTitle: 'Post',
			itemUrl: 'https://example.com/post',
			quote,
			color: 'yellow',
			occurrence: 0,
			createdAt: '2026-01-01T00:00:00.000Z',
			updatedAt: '2026-01-01T00:00:00.000Z'
		}
	]
});

let dir: string;
let storage: JsonFileStorage;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), 'meu-hub-restore-'));
	storage = new JsonFileStorage(dir);
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe('restoreBackup atômico', () => {
	it('restaura o hub anterior quando a gravação do estado falha', async () => {
		await storage.saveHub(hub('Original'));
		await storage.saveState(state('original'));
		const backup = await storage.backupNow();
		await storage.saveHub(hub('Atual'));
		await storage.saveState(state('atual'));

		const spy = vi
			.spyOn(storage as unknown as { persistState: () => Promise<void> }, 'persistState')
			.mockRejectedValueOnce(new Error('falha simulada'));

		await expect(storage.restoreBackup(backup.entry.id)).rejects.toThrow('falha simulada');
		spy.mockRestore();

		expect((await storage.loadHub()).categories[0].name).toBe('Atual');
	});

	it('restaura hub e estado quando a gravação do cache falha', async () => {
		await storage.saveHub(hub('Original'));
		await storage.saveState(state('original'));
		await storage.saveFeedCache(cache);
		const backup = await storage.backupNow();
		await storage.saveHub(hub('Atual'));
		await storage.saveState(state('atual'));

		const spy = vi
			.spyOn(storage as unknown as { persistFeedCache: () => Promise<void> }, 'persistFeedCache')
			.mockRejectedValueOnce(new Error('falha simulada'));

		await expect(storage.restoreBackup(backup.entry.id)).rejects.toThrow('falha simulada');
		spy.mockRestore();

		expect((await storage.loadHub()).categories[0].name).toBe('Atual');
		expect(await storage.loadState()).toMatchObject({ read: { atual: expect.any(String) } });
	});

	it('cria o ponto de segurança antes de sobrescrever', async () => {
		await storage.saveHub(hub('Original'));
		const backup = await storage.backupNow();
		await storage.saveHub(hub('Atual'));

		const result = await storage.restoreBackup(backup.entry.id);

		expect(result.safety.id).toMatch(/^manual-/);
		expect((await storage.loadHub()).categories[0].name).toBe('Original');
	});

	it('não deixa lock preso depois de uma falha', async () => {
		await storage.saveHub(hub('Original'));
		await storage.saveState(state('original'));
		const backup = await storage.backupNow();
		await storage.saveHub(hub('Atual'));

		const spy = vi
			.spyOn(storage as unknown as { persistState: () => Promise<void> }, 'persistState')
			.mockRejectedValueOnce(new Error('falha simulada'));

		await expect(storage.restoreBackup(backup.entry.id)).rejects.toThrow('falha simulada');
		spy.mockRestore();

		await expect(
			Promise.race([
				storage.updateHub((current) => current),
				new Promise((_, reject) => setTimeout(() => reject(new Error('lock preso')), 2000))
			])
		).resolves.toBeTruthy();
	});

	it('inclui notas e destaques no ponto e no bundle', async () => {
		await storage.saveHub(hub('Original'));
		await storage.saveNotes(notes('lembrar'));
		await storage.saveHighlights(highlights('trecho'));

		const point = await storage.backupNow();
		const bundle = await storage.loadBackupBundle(point.entry.id);

		expect(point.files).toEqual(expect.arrayContaining(['notes.json', 'highlights.json']));
		expect(point.entry.hasNotes).toBe(true);
		expect(point.entry.hasHighlights).toBe(true);
		expect(bundle.notes?.notes[0].text).toBe('lembrar');
		expect(bundle.highlights?.highlights[0].quote).toBe('trecho');
	});

	it('restaura notas e destaques junto com hub e estado', async () => {
		await storage.saveHub(hub('Original'));
		await storage.saveNotes(notes('antiga'));
		await storage.saveHighlights(highlights('antigo'));
		const point = await storage.backupNow();

		await storage.saveNotes(notes('nova'));
		await storage.saveHighlights(highlights('novo'));

		await storage.restoreBackup(point.entry.id);

		expect((await storage.loadNotes()).notes[0].text).toBe('antiga');
		expect((await storage.loadHighlights()).highlights[0].quote).toBe('antigo');
	});

	it('mantém notas e destaques atuais quando o ponto não os tem', async () => {
		await storage.saveHub(hub('Original'));
		const point = await storage.backupNow();

		await storage.saveNotes(notes('atual'));
		await storage.saveHighlights(highlights('atual'));

		await storage.restoreBackup(point.entry.id);

		expect((await storage.loadNotes()).notes[0].text).toBe('atual');
		expect((await storage.loadHighlights()).highlights[0].quote).toBe('atual');
	});

	it('não altera nada quando as notas do ponto estão inválidas', async () => {
		await storage.saveHub(hub('Original'));
		await storage.saveNotes(notes('antiga'));
		const point = await storage.backupNow();
		await writeFile(join(point.directory, 'notes.json'), '{ quebrado', 'utf-8');

		await storage.saveHub(hub('Atual'));
		await storage.saveNotes(notes('atual'));

		await expect(storage.restoreBackup(point.entry.id)).rejects.toThrow();

		expect((await storage.loadHub()).categories[0].name).toBe('Atual');
		expect((await storage.loadNotes()).notes[0].text).toBe('atual');
	});
});
