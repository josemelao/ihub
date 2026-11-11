import {
	copyFile,
	mkdir,
	readFile,
	readdir,
	rename,
	rm,
	stat,
	unlink,
	writeFile
} from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { join, resolve } from 'node:path';
import { EMPTY_FEED_CACHE, EMPTY_HUB, EMPTY_STATE } from '../defaults';
import { migrateHub } from '../migrations/hub';
import { migrateFeedCache, migrateState } from '../migrations/state';
import { HubValidationError, parseFeedCache, parseHub, parseHubState } from '../schema';
import { recoverHubState } from '../state-recovery';
import type {
	BackupCreated,
	BackupEntry,
	BackupInfo,
	BackupRestoreResult,
	ExportBundle,
	FeedCache,
	HubData,
	HubLoadResult,
	HubState,
	HubStorage,
	ImportOptions,
	StateLoadResult
} from '../types';
import { writeFileAtomically, type AtomicFileDeps } from './atomic';
import { createLockRegistry } from './mutex';

const fileLocks = createLockRegistry();
const BACKUP_GENERATIONS = 7;
const MANUAL_BACKUP_RETENTION = 10;

const nodeFileDeps: AtomicFileDeps = {
	writeFile: (path, data) => writeFile(path, data, 'utf-8'),
	readFile: (path) => readFile(path, 'utf-8'),
	copyFile: (from, to) => copyFile(from, to),
	rename: (from, to) => rename(from, to),
	unlink: (path) => unlink(path),
	sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
	uniqueSuffix: () => `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
};

function isMissingFile(error: unknown): boolean {
	return (
		error instanceof HubValidationError &&
		error.issues.some((issue) => issue.message.startsWith('Arquivo não encontrado:'))
	);
}

export class JsonFileStorage implements HubStorage {
	private readonly dataDir: string;

	constructor(dataDir = process.env.HUB_DATA_DIR ?? 'data') {
		this.dataDir = dataDir;
	}

	private path(file: string): string {
		return join(this.dataDir, file);
	}

	private lockKey(file: string): string {
		return resolve(this.path(file));
	}

	private async readJson(file: string): Promise<unknown> {
		const fullPath = this.path(file);
		let raw: string;
		try {
			raw = await readFile(fullPath, 'utf-8');
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				throw new HubValidationError(
					[
						{
							path: [],
							message: `Arquivo não encontrado: ${fullPath}. Crie o arquivo ou ajuste HUB_DATA_DIR.`
						}
					],
					file
				);
			}
			throw error;
		}

		try {
			return JSON.parse(raw);
		} catch (error) {
			throw new HubValidationError(
				[
					{
						path: [],
						message: `JSON inválido em ${fullPath}: ${(error as Error).message}`
					}
				],
				file
			);
		}
	}

	private async loadFromBackup<T>(file: string, parse: (input: unknown) => T): Promise<T | null> {
		for (let index = 0; index < BACKUP_GENERATIONS; index += 1) {
			const suffix = index === 0 ? '' : `.${index}`;
			try {
				return parse(await this.readJson(`${file}.bak${suffix}`));
			} catch (error) {
				// Conteúdo inválido/ausente: tenta a geração seguinte. Erros de I/O
				// (permissão, diretório no lugar do arquivo) devem aparecer.
				if (!(error instanceof HubValidationError)) throw error;
			}
		}
		return null;
	}

	private async writeJsonAtomic(
		file: string,
		value: unknown,
		validateBackup?: (value: unknown) => boolean
	): Promise<void> {
		await mkdir(this.dataDir, { recursive: true });
		const fullPath = this.path(file);

		await writeFileAtomically(fullPath, `${JSON.stringify(value, null, 2)}\n`, nodeFileDeps, {
			backupPath: `${fullPath}.bak`,
			backupGenerations: BACKUP_GENERATIONS,
			keepBackup: validateBackup
				? (raw) => {
						try {
							return validateBackup(JSON.parse(raw));
						} catch {
							return false;
						}
					}
				: undefined
		});
	}

	private persistHub(data: HubData): Promise<void> {
		// Todo arquivo gravado já sai na versão atual do schema.
		const migrated = migrateHub(data).data;
		return this.writeJsonAtomic('hub.json', parseHub(migrated), (value) => {
			try {
				parseHub(value);
				return true;
			} catch {
				return false;
			}
		});
	}

	private persistState(state: HubState): Promise<void> {
		return this.writeJsonAtomic('estado.json', parseHubState(state), (value) => {
			try {
				parseHubState(value);
				return true;
			} catch {
				return false;
			}
		});
	}

	private persistFeedCache(cache: FeedCache): Promise<void> {
		return this.writeJsonAtomic('feed-cache.json', parseFeedCache(cache), (value) => {
			try {
				parseFeedCache(value);
				return true;
			} catch {
				return false;
			}
		});
	}

	async updateHub(fn: (hub: HubData) => HubData | Promise<HubData>): Promise<HubData> {
		return fileLocks.withLock(this.lockKey('hub.json'), async () => {
			const next = parseHub(await fn(await this.loadHub()));
			await this.persistHub(next);
			return next;
		});
	}

	async updateState(fn: (state: HubState) => HubState | Promise<HubState>): Promise<HubState> {
		return fileLocks.withLock(this.lockKey('estado.json'), async () => {
			const next = parseHubState(await fn(await this.loadState()));
			await this.persistState(next);
			return next;
		});
	}

	/** Como `updateState`, mas repara um estado inválido usando o backup/estado vazio. */
	async updateStateWithFallback(
		fn: (state: HubState) => HubState | Promise<HubState>
	): Promise<HubState> {
		return fileLocks.withLock(this.lockKey('estado.json'), async () => {
			let current: HubState;
			try {
				current = await this.loadState();
			} catch (error) {
				if (!(error instanceof HubValidationError)) throw error;
				current = (await this.loadStateFromBackup()) ?? structuredClone(EMPTY_STATE);
			}

			const next = parseHubState(await fn(current));
			await this.persistState(next);
			return next;
		});
	}

	async updateFeedCache(
		fn: (cache: FeedCache) => FeedCache | Promise<FeedCache>
	): Promise<FeedCache> {
		return fileLocks.withLock(this.lockKey('feed-cache.json'), async () => {
			const next = parseFeedCache(await fn(await this.loadFeedCache()));
			await this.persistFeedCache(next);
			return next;
		});
	}

	async updateHubAndCache(
		hubFn: (hub: HubData) => HubData | Promise<HubData>,
		cacheFn: ((cache: FeedCache) => FeedCache | Promise<FeedCache>) | null
	): Promise<{ hub: HubData; cache: FeedCache | null }> {
		return fileLocks.withLocks(
			[this.lockKey('hub.json'), this.lockKey('feed-cache.json')],
			async () => {
				const previousHub = await this.loadHub();
				const hub = parseHub(await hubFn(previousHub));

				// Valida tudo antes de qualquer gravação: cache inválido não pode
				// deixar o hub já removido no disco.
				const cache = cacheFn ? parseFeedCache(await cacheFn(await this.loadFeedCache())) : null;

				await this.persistHub(hub);

				if (cache) {
					try {
						await this.persistFeedCache(cache);
					} catch (error) {
						await this.persistHub(previousHub).catch(() => undefined);
						throw error;
					}
				}

				return { hub, cache };
			}
		);
	}

	async loadHub(): Promise<HubData> {
		return this.migrateAndParseHub(await this.readJson('hub.json'));
	}

	/**
	 * Migra o dado cru até a versão atual e valida. Quando houve migração,
	 * guarda uma cópia `hub.json.pre-vN.bak` e grava o resultado migrado —
	 * carregar o arquivo já migrado não escreve nada.
	 */
	private async migrateAndParseHub(raw: unknown): Promise<HubData> {
		const { data, from, to } = migrateHub(raw);
		const hub = parseHub(data);
		if (from > 0 && to > from) await this.persistHubMigration(hub, from);
		return hub;
	}

	private async persistHubMigration(hub: HubData, from: number): Promise<void> {
		const source = this.path('hub.json');
		const pre = `${source}.pre-v${from}.bak`;
		try {
			await copyFile(source, pre, fsConstants.COPYFILE_EXCL);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
		}
		await this.persistHub(hub);
	}

	async loadHubFromBackup(): Promise<HubData | null> {
		return this.loadFromBackup('hub.json', (raw) => parseHub(migrateHub(raw).data));
	}

	async loadHubWithFallback(): Promise<HubLoadResult> {
		try {
			return { hub: await this.loadHub(), error: null };
		} catch (error) {
			if (!(error instanceof HubValidationError)) throw error;
			const backup = await this.loadHubFromBackup();
			return {
				hub: backup ?? structuredClone(EMPTY_HUB),
				error: {
					message: error.message,
					issues: error.issues,
					usingBackup: backup !== null
				}
			};
		}
	}

	async saveHub(data: HubData): Promise<void> {
		await this.persistHub(data);
	}

	async loadState(): Promise<HubState> {
		return (await this.loadStateWithRecovery()).state;
	}

	/**
	 * Como `loadState`, mas descarta apenas as entradas inválidas (snapshot,
	 * leitura ou id salvo) e informa o que foi recuperado. Erro estrutural
	 * continua lançando, para o chamador cair no backup/estado vazio.
	 */
	async loadStateWithRecovery(): Promise<StateLoadResult> {
		try {
			const raw = await this.readJson('estado.json');
			const { state, recovery } = recoverHubState(migrateState(raw).data);
			const touched = recovery.removedSnapshots + recovery.removedRead + recovery.removedSaved;
			return { state, recovery: touched > 0 ? recovery : null };
		} catch (error) {
			if (isMissingFile(error)) {
				return { state: structuredClone(EMPTY_STATE), recovery: null };
			}
			throw error;
		}
	}

	async loadStateFromBackup(): Promise<HubState | null> {
		return this.loadFromBackup('estado.json', parseHubState);
	}

	async saveState(state: HubState): Promise<void> {
		await this.persistState(state);
	}

	async loadFeedCache(): Promise<FeedCache> {
		try {
			const raw = await this.readJson('feed-cache.json');
			return parseFeedCache(migrateFeedCache(raw).data);
		} catch (error) {
			if (isMissingFile(error)) {
				return structuredClone(EMPTY_FEED_CACHE);
			}
			throw error;
		}
	}

	async loadFeedCacheFromBackup(): Promise<FeedCache | null> {
		return this.loadFromBackup('feed-cache.json', parseFeedCache);
	}

	async saveFeedCache(cache: FeedCache): Promise<void> {
		await this.persistFeedCache(cache);
	}

	async exportBundle(): Promise<ExportBundle> {
		return { hub: await this.loadHub(), state: await this.loadState() };
	}

	async importBundle(
		bundle: ExportBundle,
		mode: 'replace' | 'merge',
		options: ImportOptions = {}
	): Promise<void> {
		const incoming = parseHub(bundle.hub);
		const incomingState = bundle.state ? parseHubState(bundle.state) : null;

		await fileLocks.withLocks([this.lockKey('hub.json'), this.lockKey('estado.json')], async () => {
			// Lê e valida tudo antes de gravar: estado inválido não pode deixar
			// o hub já importado no disco.
			let previousHub: HubData | null = null;
			try {
				previousHub = await this.loadHub();
			} catch (error) {
				if (!(error instanceof HubValidationError)) throw error;
				if (mode === 'merge') {
					previousHub = await this.loadHubFromBackup();
					if (!previousHub) {
						throw new HubValidationError([
							...error.issues,
							{
								path: [],
								message:
									'Importação mesclada cancelada: o hub.json atual é inválido e não há backup válido.'
							}
						]);
					}
				}
			}

			const currentState = incomingState ? await this.loadState() : null;

			if (mode === 'replace') {
				await this.persistHub(incoming);
				if (incomingState) {
					try {
						await this.persistState(incomingState);
					} catch (error) {
						if (previousHub) await this.persistHub(previousHub).catch(() => undefined);
						throw error;
					}
				}
				return;
			}

			if (!previousHub) {
				throw new HubValidationError([
					{
						path: [],
						message: 'Importação mesclada cancelada: não foi possível ler o hub atual.'
					}
				]);
			}

			const mergedHub = mergeByIdAll(previousHub, incoming, options.settingsPolicy ?? 'keep');
			let mergedState: HubState | null = null;

			if (incomingState && currentState) {
				const mergedSaved = [...new Set([...currentState.saved, ...incomingState.saved])];
				const savedItems = { ...currentState.savedItems, ...incomingState.savedItems };
				for (const id of Object.keys(savedItems)) {
					if (!mergedSaved.includes(id)) delete savedItems[id];
				}

				mergedState = {
					version: 1,
					read: { ...currentState.read, ...incomingState.read },
					saved: mergedSaved,
					savedItems
				};
			}

			await this.persistHub(mergedHub);

			if (mergedState) {
				try {
					await this.persistState(mergedState);
				} catch (error) {
					await this.persistHub(previousHub).catch(() => undefined);
					throw error;
				}
			}
		});
	}

	private backupsRoot(): string {
		return resolve(this.dataDir, 'backups');
	}

	private async readJsonAt(fullPath: string, label: string): Promise<unknown> {
		let raw: string;
		try {
			raw = await readFile(fullPath, 'utf-8');
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				throw new HubValidationError(
					[{ path: [], message: `Arquivo não encontrado: ${fullPath}` }],
					label
				);
			}
			throw error;
		}

		try {
			return JSON.parse(raw);
		} catch (error) {
			throw new HubValidationError(
				[
					{
						path: [],
						message: `JSON inválido em ${fullPath}: ${(error as Error).message}`
					}
				],
				label
			);
		}
	}

	private async listManualBackups(): Promise<BackupEntry[]> {
		const root = this.backupsRoot();
		let entries;
		try {
			entries = await readdir(root, { withFileTypes: true });
		} catch {
			return [];
		}

		const result: BackupEntry[] = [];
		for (const entry of entries) {
			if (!entry.isDirectory() || !isSafeBackupId(entry.name)) continue;

			const path = join(root, entry.name);
			try {
				const dirStat = await stat(path);
				const names = await readdir(path);
				let sizeBytes = 0;
				for (const name of names) {
					try {
						sizeBytes += (await stat(join(path, name))).size;
					} catch {
						// arquivo removido no meio da leitura
					}
				}

				result.push({
					id: entry.name,
					createdAt: dirStat.mtime.toISOString(),
					path,
					files: names.length,
					sizeBytes,
					hasHub: names.includes('hub.json'),
					hasState: names.includes('estado.json'),
					hasCache: names.includes('feed-cache.json')
				});
			} catch {
				// pasta inacessível: ignora
			}
		}

		return result.sort(
			(a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)
		);
	}

	private async requireManualBackup(id: string): Promise<BackupEntry> {
		if (!isSafeBackupId(id)) {
			throw new HubValidationError(
				[{ path: ['id'], message: 'Ponto de restauração inválido.' }],
				'backup'
			);
		}

		const entries = await this.listManualBackups();
		const found = entries.find((entry) => entry.id === id);
		if (!found) {
			throw new HubValidationError(
				[{ path: ['id'], message: 'Ponto de restauração não encontrado.' }],
				'backup'
			);
		}
		return found;
	}

	private async pruneManualBackups(): Promise<void> {
		const entries = await this.listManualBackups();
		for (const entry of entries.slice(MANUAL_BACKUP_RETENTION)) {
			await rm(entry.path, { recursive: true, force: true }).catch(() => undefined);
		}
	}

	async backupNow(): Promise<BackupCreated> {
		return fileLocks.withLocks(
			[this.lockKey('hub.json'), this.lockKey('estado.json'), this.lockKey('feed-cache.json')],
			() => this.createBackupUnlocked()
		);
	}

	/** Cópia manual dos arquivos atuais. O chamador precisa segurar os locks. */
	private async createBackupUnlocked(): Promise<BackupCreated> {
		const createdAt = new Date();
		const stamp = createdAt.toISOString().replace(/[:.]/g, '-');
		const id = `manual-${stamp}`;
		const directory = resolve(this.dataDir, 'backups', id);

		await mkdir(directory, { recursive: true });

		let entries: string[];
		try {
			entries = await readdir(this.dataDir);
		} catch {
			entries = [];
		}

		const files: string[] = [];
		for (const base of ['hub.json', 'estado.json', 'feed-cache.json']) {
			const candidates = entries
				.filter((name) => name === base || name.startsWith(`${base}.bak`))
				.sort();
			for (const name of candidates) {
				try {
					await copyFile(this.path(name), join(directory, name));
					files.push(name);
				} catch (error) {
					if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
				}
			}
		}

		await writeFile(
			join(directory, 'backup-info.txt'),
			`Backup manual\nData: ${createdAt.toISOString()}\nArquivos: ${files.join(', ')}\n`,
			'utf-8'
		);

		const entry = (await this.listManualBackups()).find((candidate) => candidate.id === id) ?? {
			id,
			createdAt: createdAt.toISOString(),
			path: directory,
			files: files.length,
			sizeBytes: 0,
			hasHub: files.includes('hub.json'),
			hasState: files.includes('estado.json'),
			hasCache: files.includes('feed-cache.json')
		};

		await this.pruneManualBackups();

		return { directory, createdAt: createdAt.toISOString(), files, entry };
	}

	async backupInfo(): Promise<BackupInfo> {
		let lastAutomaticAt: string | null;
		try {
			lastAutomaticAt = (await stat(`${this.path('hub.json')}.bak`)).mtime.toISOString();
		} catch {
			lastAutomaticAt = null;
		}

		const manual = await this.listManualBackups();

		let generations = 0;
		for (let index = 0; index < BACKUP_GENERATIONS; index += 1) {
			const suffix = index === 0 ? '' : `.${index}`;
			try {
				await stat(`${this.path('hub.json')}.bak${suffix}`);
				generations += 1;
			} catch {
				// geração ausente
			}
		}

		return {
			lastAutomaticAt,
			lastManualAt: manual[0]?.createdAt ?? null,
			generations,
			retention: BACKUP_GENERATIONS,
			manualRetention: MANUAL_BACKUP_RETENTION,
			root: this.backupsRoot(),
			manual
		};
	}

	async loadBackupBundle(id: string): Promise<ExportBundle> {
		const entry = await this.requireManualBackup(id);
		const hub = parseHub(await this.readJsonAt(join(entry.path, 'hub.json'), 'backup'));
		if (!entry.hasState) return { hub };

		const state = parseHubState(await this.readJsonAt(join(entry.path, 'estado.json'), 'backup'));
		return { hub, state };
	}

	async restoreBackup(id: string): Promise<BackupRestoreResult> {
		const entry = await this.requireManualBackup(id);
		const hub = parseHub(await this.readJsonAt(join(entry.path, 'hub.json'), 'backup'));
		const state = entry.hasState
			? parseHubState(await this.readJsonAt(join(entry.path, 'estado.json'), 'backup'))
			: null;

		let cache: FeedCache | null = null;
		if (entry.hasCache) {
			try {
				cache = parseFeedCache(
					await this.readJsonAt(join(entry.path, 'feed-cache.json'), 'backup')
				);
			} catch (error) {
				if (!(error instanceof HubValidationError)) throw error;
				// cache é descartável: restaura hub/estado mesmo se ele estiver inválido
			}
		}

		// Antes de sobrescrever, guarda o estado atual para permitir desfazer.
		// Tudo acontece sob os três locks, e qualquer falha de escrita desfaz o
		// que já foi gravado para não deixar hub/estado/cache misturados.
		return fileLocks.withLocks(
			[this.lockKey('hub.json'), this.lockKey('estado.json'), this.lockKey('feed-cache.json')],
			async () => {
				const previousHub = await this.loadHub().catch((error) => {
					if (error instanceof HubValidationError) return null;
					throw error;
				});
				const previousState = await this.loadState().catch((error) => {
					if (error instanceof HubValidationError) return null;
					throw error;
				});
				const previousCache = await this.loadFeedCache().catch((error) => {
					if (error instanceof HubValidationError) return null;
					throw error;
				});

				const safety = await this.createBackupUnlocked();

				try {
					await this.persistHub(hub);
					if (state) await this.persistState(state);
					if (cache) await this.persistFeedCache(cache);
				} catch (error) {
					if (previousHub) await this.persistHub(previousHub).catch(() => undefined);
					if (state && previousState) {
						await this.persistState(previousState).catch(() => undefined);
					}
					if (cache && previousCache) {
						await this.persistFeedCache(previousCache).catch(() => undefined);
					}
					throw error;
				}

				return { restored: entry, safety: safety.entry };
			}
		);
	}

	async deleteBackup(id: string): Promise<{ id: string }> {
		const entry = await this.requireManualBackup(id);
		await rm(entry.path, { recursive: true, force: true });
		return { id: entry.id };
	}
}

export function isSafeBackupId(value: string): boolean {
	return /^manual-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/.test(value);
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
	const merged = new Map(current.map((entry) => [entry.id, entry]));
	for (const entry of incoming) merged.set(entry.id, entry);
	return [...merged.values()];
}

function mergeByIdAll(
	current: HubData,
	incoming: HubData,
	settingsPolicy: 'keep' | 'incoming' = 'keep'
): HubData {
	return {
		version: incoming.version,
		settings: settingsPolicy === 'keep' ? current.settings : incoming.settings,
		categories: mergeById(current.categories, incoming.categories),
		groups: mergeById(current.groups, incoming.groups),
		items: mergeById(current.items, incoming.items),
		feedSources: mergeById(current.feedSources, incoming.feedSources),
		savedFilters: mergeById(current.savedFilters, incoming.savedFilters)
	};
}
