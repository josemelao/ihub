import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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

	it('rejeita estado inválido e oferece backup válido', async () => {
		const valid = {
			version: 1,
			read: { post: '2026-11-09T12:00:00Z' },
			saved: [],
			savedItems: {}
		};
		await storage.saveState(valid);
		await storage.saveState(valid);
		await writeFile(join(dir, 'estado.json'), JSON.stringify({ savedItems: 'quebrado' }), 'utf-8');

		await expect(storage.loadState()).rejects.toThrow(HubValidationError);
		await expect(storage.loadStateFromBackup()).resolves.toEqual(valid);
	});

	it('rejeita cache inválido', async () => {
		await writeFile(
			join(dir, 'feed-cache.json'),
			JSON.stringify({
				items: [
					{
						id: 'x',
						sourceId: 's',
						title: 'X',
						url: 'javascript:alert(1)',
						publishedAt: '',
						thumbnail: null
					}
				]
			}),
			'utf-8'
		);

		await expect(storage.loadFeedCache()).rejects.toThrow(HubValidationError);
	});

	it('não grava estado com snapshot de URL perigosa', async () => {
		await expect(
			storage.saveState({
				version: 1,
				read: {},
				saved: ['x'],
				savedItems: {
					x: {
						item: {
							id: 'x',
							sourceId: 's',
							title: 'X',
							summary: '',
							url: 'javascript:alert(1)',
							publishedAt: '',
							thumbnail: null
						},
						sourceId: 's',
						sourceName: 'Fonte',
						savedAt: ''
					}
				}
			})
		).rejects.toThrow(HubValidationError);
	});

	it('aborta importação com estado inválido antes de gravar o hub', async () => {
		await storage.saveHub(hub('Original'));
		const incoming = hub('Novo');
		incoming.categories[0].id = 'ferramentas';

		await expect(
			storage.importBundle(
				{
					hub: incoming,
					state: {
						version: 1,
						read: {},
						saved: ['x'],
						savedItems: {
							x: {
								item: {
									id: 'x',
									sourceId: 's',
									title: 'X',
									summary: '',
									url: 'data:text/html,oi',
									publishedAt: '',
									thumbnail: null
								},
								sourceId: 's',
								sourceName: 'Fonte',
								savedAt: ''
							}
						}
					}
				},
				'replace'
			)
		).rejects.toThrow(HubValidationError);

		const loaded = await storage.loadHub();
		expect(loaded.categories[0].name).toBe('Original');
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

	it('não perde updates concorrentes do hub', async () => {
		await storage.saveHub(hub('Base'));

		await Promise.all(
			Array.from({ length: 10 }, (_, index) =>
				storage.updateHub((current) => ({
					...current,
					categories: [
						...current.categories,
						{
							id: `concorrente-${index}`,
							name: `Concorrente ${index}`,
							color: '#8AA4FF',
							order: index + 2
						}
					]
				}))
			)
		);

		const loaded = await storage.loadHub();
		expect(loaded.categories).toHaveLength(11);
		expect(loaded.categories.map((category) => category.id)).toEqual(
			expect.arrayContaining(Array.from({ length: 10 }, (_, index) => `concorrente-${index}`))
		);
	});

	it('não perde updates concorrentes do estado', async () => {
		await storage.saveState({ version: 1, read: {}, saved: [], savedItems: {} });

		await Promise.all(
			Array.from({ length: 10 }, (_, index) =>
				storage.updateState((current) => ({
					...current,
					read: { ...current.read, [`post-${index}`]: '2026-11-10T12:00:00Z' }
				}))
			)
		);

		const loaded = await storage.loadState();
		expect(Object.keys(loaded.read)).toHaveLength(10);
	});

	it('não perde updates concorrentes do cache', async () => {
		await storage.saveFeedCache({
			version: 1,
			updatedAt: '2026-11-10T12:00:00Z',
			items: [],
			sources: {}
		});

		await Promise.all(
			Array.from({ length: 10 }, (_, index) =>
				storage.updateFeedCache((current) => ({
					...current,
					items: [
						...current.items,
						{
							id: `item-${index}`,
							sourceId: 'fonte',
							title: `Item ${index}`,
							summary: '',
							url: `https://example.com/${index}`,
							publishedAt: '',
							thumbnail: null
						}
					]
				}))
			)
		);

		const loaded = await storage.loadFeedCache();
		expect(loaded.items).toHaveLength(10);
	});

	it('não grava quando o updater lança erro', async () => {
		await storage.saveHub(hub('Original'));

		await expect(
			storage.updateHub(() => {
				throw new Error('falhou no meio');
			})
		).rejects.toThrow('falhou no meio');

		const loaded = await storage.loadHub();
		expect(loaded.categories[0].name).toBe('Original');
	});

	it('atualiza hub e cache na mesma transação', async () => {
		const withSource = hub('Jogos');
		withSource.feedSources.push({
			id: 'fonte',
			type: 'rss',
			name: 'Fonte',
			target: 'https://example.com/feed',
			categoryId: 'jogos',
			intervalMinutes: 30,
			enabled: true,
			include: [],
			exclude: [],
			matchMode: 'any'
		});
		await storage.saveHub(withSource);
		await storage.saveFeedCache({
			version: 1,
			updatedAt: '2026-11-10T12:00:00Z',
			items: [
				{
					id: 'post',
					sourceId: 'fonte',
					title: 'Post',
					summary: '',
					url: 'https://example.com/post',
					publishedAt: '',
					thumbnail: null
				}
			],
			sources: { fonte: { lastFetchedAt: '', error: null, count: 1 } }
		});

		const result = await storage.updateHubAndCache(
			(current) => ({ ...current, feedSources: [] }),
			(current) => ({
				...current,
				items: current.items.filter((item) => item.sourceId !== 'fonte'),
				sources: {}
			})
		);

		expect(result.hub.feedSources).toEqual([]);
		expect(result.cache?.items).toEqual([]);
		expect((await storage.loadHub()).feedSources).toEqual([]);
		expect((await storage.loadFeedCache()).items).toEqual([]);
	});

	it('aborta sem alterar o hub quando o cache está inválido', async () => {
		const withSource = hub('Jogos');
		withSource.feedSources.push({
			id: 'fonte',
			type: 'rss',
			name: 'Fonte',
			target: 'https://example.com/feed',
			categoryId: 'jogos',
			intervalMinutes: 30,
			enabled: true,
			include: [],
			exclude: [],
			matchMode: 'any'
		});
		await storage.saveHub(withSource);
		await writeFile(join(dir, 'feed-cache.json'), '{ quebrado', 'utf-8');

		await expect(
			storage.updateHubAndCache(
				(current) => ({ ...current, feedSources: [] }),
				(current) => current
			)
		).rejects.toThrow(HubValidationError);

		const loaded = await storage.loadHub();
		expect(loaded.feedSources.map((source) => source.id)).toEqual(['fonte']);
	});

	it('mescla mantendo as settings atuais por padrão', async () => {
		const current = hub('Original');
		current.settings = { accent: '#111111' };
		await storage.saveHub(current);

		const incoming = hub('Novo');
		incoming.categories[0].id = 'ferramentas';
		incoming.settings = { accent: '#222222' };
		await storage.importBundle({ hub: incoming }, 'merge');

		expect((await storage.loadHub()).settings).toEqual({ accent: '#111111' });
	});

	it('mescla usando as settings do arquivo quando pedido', async () => {
		const current = hub('Original');
		current.settings = { accent: '#111111' };
		await storage.saveHub(current);

		const incoming = hub('Novo');
		incoming.categories[0].id = 'ferramentas';
		incoming.settings = { accent: '#222222' };
		await storage.importBundle({ hub: incoming }, 'merge', { settingsPolicy: 'incoming' });

		expect((await storage.loadHub()).settings).toEqual({ accent: '#222222' });
	});

	it('substituir sempre usa as settings do arquivo', async () => {
		const current = hub('Original');
		current.settings = { accent: '#111111' };
		await storage.saveHub(current);

		const incoming = hub('Novo');
		incoming.settings = { accent: '#222222' };
		await storage.importBundle({ hub: incoming }, 'replace', { settingsPolicy: 'keep' });

		expect((await storage.loadHub()).settings).toEqual({ accent: '#222222' });
	});

	it('mantém no máximo 7 gerações de backup', async () => {
		for (let index = 0; index < 9; index += 1) {
			await storage.saveHub(hub(`Versão ${index}`));
		}

		const newest = JSON.parse(await readFile(join(dir, 'hub.json.bak'), 'utf-8'));
		const oldest = JSON.parse(await readFile(join(dir, 'hub.json.bak.6'), 'utf-8'));
		expect(newest.categories[0].name).toBe('Versão 7');
		expect(oldest.categories[0].name).toBe('Versão 1');
		await expect(readFile(join(dir, 'hub.json.bak.7'), 'utf-8')).rejects.toThrow();
	});

	it('cria backup manual datado com os arquivos atuais', async () => {
		await storage.saveHub(hub('Anterior'));
		await storage.saveHub(hub('Atual'));
		await storage.saveState({ version: 1, read: { a: 't' }, saved: [], savedItems: {} });

		const backup = await storage.backupNow();

		expect(backup.directory).toContain('backups');
		expect(backup.files).toEqual(
			expect.arrayContaining(['hub.json', 'hub.json.bak', 'estado.json'])
		);

		const copied = JSON.parse(await readFile(join(backup.directory, 'hub.json'), 'utf-8'));
		expect(copied.categories[0].name).toBe('Atual');

		const info = await storage.backupInfo();
		expect(info.lastAutomaticAt).toBeTruthy();
		expect(info.lastManualAt).toBeTruthy();
		expect(info.generations).toBeGreaterThan(0);
	});

	it('usa geração mais antiga quando o backup mais novo está corrompido', async () => {
		await storage.saveHub(hub('Versão 1'));
		await storage.saveHub(hub('Versão 2'));
		await storage.saveHub(hub('Versão 3'));

		await writeFile(join(dir, 'hub.json.bak'), '{ quebrado', 'utf-8');

		const backup = await storage.loadHubFromBackup();
		expect(backup?.categories[0].name).toBe('Versão 1');
	});

	it('carrega hub com fallback e descreve o erro', async () => {
		await storage.saveHub(hub('Versão 1'));
		await storage.saveHub(hub('Versão 2'));
		await writeFile(join(dir, 'hub.json'), '{ quebrado', 'utf-8');

		const result = await storage.loadHubWithFallback();

		expect(result.hub.categories[0].name).toBe('Versão 1');
		expect(result.error?.usingBackup).toBe(true);
		expect(result.error?.issues.length).toBeGreaterThan(0);
	});

	it('devolve hub vazio quando não há backup válido', async () => {
		await writeFile(join(dir, 'hub.json'), '{ quebrado', 'utf-8');

		const result = await storage.loadHubWithFallback();

		expect(result.hub.categories).toEqual([]);
		expect(result.error?.usingBackup).toBe(false);
	});

	it('recupera estado inválido usando o backup ao atualizar', async () => {
		const valid = {
			version: 1,
			read: { antigo: '2026-11-09T12:00:00Z' },
			saved: [],
			savedItems: {}
		};
		await storage.saveState(valid);
		await storage.saveState(valid);
		await writeFile(join(dir, 'estado.json'), '{ quebrado', 'utf-8');

		const next = await storage.updateStateWithFallback((current) => ({
			...current,
			read: { ...current.read, novo: '2026-11-10T12:00:00Z' }
		}));

		expect(next.read.antigo).toBe('2026-11-09T12:00:00Z');
		expect(next.read.novo).toBe('2026-11-10T12:00:00Z');
		expect((await storage.loadState()).read.antigo).toBe('2026-11-09T12:00:00Z');
	});

	it('usa estado vazio quando não há backup ao atualizar', async () => {
		await writeFile(join(dir, 'estado.json'), '{ quebrado', 'utf-8');

		const next = await storage.updateStateWithFallback((current) => ({
			...current,
			read: { ...current.read, novo: '2026-11-10T12:00:00Z' }
		}));

		expect(next.read).toEqual({ novo: '2026-11-10T12:00:00Z' });
		expect((await storage.loadState()).read.novo).toBe('2026-11-10T12:00:00Z');
	});

	it('não altera o hub no merge quando o estado atual é inválido', async () => {
		await storage.saveHub(hub('Original'));
		await writeFile(join(dir, 'estado.json'), '{ quebrado', 'utf-8');

		const incoming = hub('Novo');
		incoming.categories[0].id = 'ferramentas';

		await expect(
			storage.importBundle(
				{
					hub: incoming,
					state: { version: 1, read: { a: 't' }, saved: [], savedItems: {} }
				},
				'merge'
			)
		).rejects.toThrow(HubValidationError);

		const loaded = await storage.loadHub();
		expect(loaded.categories.map((category) => category.id)).toEqual(['jogos']);
	});

	it('propaga erro de leitura de backup que não seja conteúdo inválido', async () => {
		await mkdir(join(dir, 'hub.json.bak'));

		await expect(storage.loadHubFromBackup()).rejects.toThrow();
	});

	it('cria ponto de restauração com caminho absoluto e lista', async () => {
		await storage.saveHub(hub('Ponto'));

		const created = await storage.backupNow();
		const info = await storage.backupInfo();

		expect(created.entry.id).toMatch(/^manual-/);
		expect(created.entry.path).toBe(resolve(created.directory));
		expect(created.entry.hasHub).toBe(true);
		expect(created.entry.files).toBeGreaterThan(0);
		expect(created.entry.sizeBytes).toBeGreaterThan(0);
		expect(info.root).toBe(resolve(join(dir, 'backups')));
		expect(info.manual[0].id).toBe(created.entry.id);
		expect(info.manualRetention).toBe(10);
	});

	it('restaura hub e estado de um ponto e cria ponto de segurança', async () => {
		await storage.saveHub(hub('Antes'));
		await storage.saveState({
			version: 1,
			read: { antigo: '2026-11-01T12:00:00Z' },
			saved: [],
			savedItems: {}
		});
		const point = await storage.backupNow();

		await storage.saveHub(hub('Depois'));
		await storage.saveState({
			version: 1,
			read: { novo: '2026-11-10T12:00:00Z' },
			saved: [],
			savedItems: {}
		});

		const result = await storage.restoreBackup(point.entry.id);

		expect((await storage.loadHub()).categories[0].name).toBe('Antes');
		expect(Object.keys((await storage.loadState()).read)).toEqual(['antigo']);
		expect(result.restored.id).toBe(point.entry.id);
		expect(result.safety.id).not.toBe(point.entry.id);
		expect((await storage.backupInfo()).manual.length).toBeGreaterThanOrEqual(2);
	});

	it('rejeita id de backup com travessia de caminho', async () => {
		await expect(storage.restoreBackup('../hub.json')).rejects.toThrow(HubValidationError);
		await expect(storage.loadBackupBundle('../hub.json')).rejects.toThrow(HubValidationError);
	});

	it('não altera dados quando o ponto tem hub inválido', async () => {
		await storage.saveHub(hub('Original'));
		const created = await storage.backupNow();
		await writeFile(join(created.directory, 'hub.json'), '{ quebrado', 'utf-8');

		await expect(storage.restoreBackup(created.entry.id)).rejects.toThrow(HubValidationError);

		expect((await storage.loadHub()).categories[0].name).toBe('Original');
		const info = await storage.backupInfo();
		expect(info.manual).toHaveLength(1);
	});

	it('baixa um bundle importável a partir do ponto', async () => {
		await storage.saveHub(hub('Exportado'));
		await storage.saveState({
			version: 1,
			read: { a: '2026-11-09T12:00:00Z' },
			saved: [],
			savedItems: {}
		});
		const point = await storage.backupNow();

		const bundle = await storage.loadBackupBundle(point.entry.id);

		expect(bundle.hub.categories[0].name).toBe('Exportado');
		expect(Object.keys(bundle.state?.read ?? {})).toEqual(['a']);
	});

	it('lista apenas pastas manual-* válidas', async () => {
		await mkdir(join(dir, 'backups', 'security-20260101'), { recursive: true });
		await mkdir(join(dir, 'backups', 'manual-invalido'), { recursive: true });
		await storage.saveHub(hub('Válido'));
		const created = await storage.backupNow();

		const info = await storage.backupInfo();

		expect(info.manual.map((entry) => entry.id)).toEqual([created.entry.id]);
	});

	it('limita os pontos manuais aos 10 mais recentes', async () => {
		await storage.saveHub(hub('Base'));

		for (let index = 0; index < 12; index += 1) {
			await storage.backupNow();
		}

		const info = await storage.backupInfo();
		expect(info.manual).toHaveLength(10);
	});
});
