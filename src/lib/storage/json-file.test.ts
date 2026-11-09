import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonFileStorage } from './json-file';
import { HubValidationError } from '../schema';
import type { HubData } from '../types';

const hub = (name: string): HubData => ({
	version: 1,
	settings: { accent: '#8AA4FF' },
	categories: [{ id: 'jogos', name, color: '#8AA4FF', order: 1 }],
	groups: [],
	items: [],
	feedSources: [],
	savedFilters: []
});

let dir: string;
let storage: JsonFileStorage;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), 'meu-hub-'));
	storage = new JsonFileStorage(dir);
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe('JsonFileStorage', () => {
	it('grava e lê o hub de volta', async () => {
		await storage.saveHub(hub('Jogos'));
		const loaded = await storage.loadHub();
		expect(loaded.categories[0].name).toBe('Jogos');
		expect(loaded.version).toBe(1);
	});

	it('cria backup do arquivo anterior ao gravar de novo', async () => {
		await storage.saveHub(hub('Primeiro'));
		await storage.saveHub(hub('Segundo'));

		const backup = JSON.parse(await readFile(join(dir, 'hub.json.bak'), 'utf-8'));
		expect(backup.categories[0].name).toBe('Primeiro');
	});

	it('explica erro de JSON inválido no arquivo', async () => {
		await writeFile(join(dir, 'hub.json'), '{ isso não é json }', 'utf-8');
		await expect(storage.loadHub()).rejects.toThrow(HubValidationError);
		await expect(storage.loadHub()).rejects.toThrow(/JSON inválido/i);
	});

	it('importa em modo merge preservando ids existentes', async () => {
		await storage.saveHub(hub('Original'));

		const incoming = hub('Novo');
		incoming.categories[0].id = 'ferramentas';
		incoming.categories[0].name = 'Ferramentas';

		await storage.importBundle({ hub: incoming }, 'merge');
		const loaded = await storage.loadHub();

		expect(loaded.categories.map((c) => c.id)).toEqual(['jogos', 'ferramentas']);
	});

	it('não sobrescreve o backup válido quando o hub atual está corrompido', async () => {
		await storage.saveHub(hub('Primeiro'));
		await storage.saveHub(hub('Segundo'));

		await writeFile(join(dir, 'hub.json'), '{ isso não é json }', 'utf-8');
		await storage.saveHub(hub('Terceiro'));

		const backup = JSON.parse(await readFile(join(dir, 'hub.json.bak'), 'utf-8'));
		expect(backup.categories[0].name).toBe('Primeiro');
	});

	it('aborta merge quando o hub atual é inválido e não há backup', async () => {
		await writeFile(join(dir, 'hub.json'), '{ isso não é json }', 'utf-8');

		await expect(storage.importBundle({ hub: hub('Novo') }, 'merge')).rejects.toThrow(
			HubValidationError
		);
	});

	it('usa o backup no merge quando o hub atual está corrompido', async () => {
		await storage.saveHub(hub('Original'));
		await storage.saveHub(hub('Segundo'));

		await writeFile(join(dir, 'hub.json'), '{ isso não é json }', 'utf-8');

		const incoming = hub('Novo');
		incoming.categories[0].id = 'ferramentas';
		await storage.importBundle({ hub: incoming }, 'merge');

		const loaded = await storage.loadHub();
		expect(loaded.categories.map((c) => c.id)).toEqual(['jogos', 'ferramentas']);
	});

	it('retorna estado vazio quando estado.json ainda não existe', async () => {
		await storage.saveHub(hub('Jogos'));
		const state = await storage.loadState();
		expect(state).toEqual({ version: 1, read: {}, saved: [] });
	});

	it('retorna cache vazio quando feed-cache.json ainda não existe', async () => {
		await storage.saveHub(hub('Jogos'));
		const cache = await storage.loadFeedCache();
		expect(cache.items).toEqual([]);
		expect(cache.version).toBe(1);
	});
});
