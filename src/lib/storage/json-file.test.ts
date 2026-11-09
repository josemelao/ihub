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
		expect(state).toEqual({ version: 1, read: {}, saved: [], savedItems: {} });
	});

	it('retorna cache vazio quando feed-cache.json ainda não existe', async () => {
		await storage.saveHub(hub('Jogos'));
		const cache = await storage.loadFeedCache();
		expect(cache.items).toEqual([]);
		expect(cache.version).toBe(1);
	});

	it('exporta hub e estado juntos', async () => {
		await storage.saveHub(hub('Jogos'));
		await storage.saveState({
			version: 1,
			read: { post: '2026-11-09T12:00:00Z' },
			saved: ['post'],
			savedItems: {}
		});

		const bundle = await storage.exportBundle();
		expect(bundle.hub.categories[0].name).toBe('Jogos');
		expect(bundle.state).toEqual({
			version: 1,
			read: { post: '2026-11-09T12:00:00Z' },
			saved: ['post'],
			savedItems: {}
		});
	});

	it('importa no modo substituir, incluindo o estado', async () => {
		await storage.saveHub(hub('Original'));

		const incoming = hub('Novo');
		incoming.categories[0].id = 'ferramentas';
		await storage.importBundle(
			{
				hub: incoming,
				state: {
					version: 1,
					read: { novo: '2026-11-09T12:00:00Z' },
					saved: ['novo'],
					savedItems: {}
				}
			},
			'replace'
		);

		const loaded = await storage.loadHub();
		const state = await storage.loadState();
		expect(loaded.categories.map((c) => c.id)).toEqual(['ferramentas']);
		expect(state.saved).toEqual(['novo']);
	});

	it('mescla o estado no modo merge', async () => {
		await storage.saveHub(hub('Original'));
		await storage.saveState({ version: 1, read: { a: 't1' }, saved: ['a'], savedItems: {} });

		const incoming = hub('Novo');
		incoming.categories[0].id = 'ferramentas';
		await storage.importBundle(
			{ hub: incoming, state: { version: 1, read: { b: 't2' }, saved: ['b'], savedItems: {} } },
			'merge'
		);

		const state = await storage.loadState();
		expect(Object.keys(state.read).sort()).toEqual(['a', 'b']);
		expect(state.saved.sort()).toEqual(['a', 'b']);
	});

	it('persiste o snapshot dos posts salvos', async () => {
		const state = {
			version: 1,
			read: {},
			saved: ['post-1'],
			savedItems: {
				'post-1': {
					item: {
						id: 'post-1',
						sourceId: 'fonte',
						title: 'Salvo',
						summary: '',
						url: 'https://example.com/1',
						publishedAt: '2026-11-09T12:00:00Z',
						thumbnail: null
					},
					sourceId: 'fonte',
					sourceName: 'Fonte',
					categoryId: 'jogos',
					categoryName: 'Jogos',
					color: '#8AA4FF',
					savedAt: '2026-11-09T12:00:00Z'
				}
			}
		};

		await storage.saveState(state);
		const loaded = await storage.loadState();
		expect(loaded.savedItems['post-1'].sourceName).toBe('Fonte');
		expect(loaded.savedItems['post-1'].item.title).toBe('Salvo');
	});

	it('completa savedItems vazio ao ler estado antigo', async () => {
		await storage.saveHub(hub('Jogos'));
		await writeFile(
			join(dir, 'estado.json'),
			JSON.stringify({ version: 1, read: { a: 't' }, saved: ['a'] }),
			'utf-8'
		);

		const loaded = await storage.loadState();
		expect(loaded.savedItems).toEqual({});
	});
});
