import {
	copyFile,
	mkdir,
	readFile,
	readdir,
	rename,
	stat,
	unlink,
	writeFile
} from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { EMPTY_FEED_CACHE, EMPTY_HUB, EMPTY_STATE } from '../defaults';
import { HubValidationError, parseFeedCache, parseHub, parseHubState } from '../schema';
import type {
	BackupCreated,
	BackupInfo,
	ExportBundle,
	FeedCache,
	HubData,
	HubLoadResult,
	HubState,
	HubStorage,
	ImportOptions
} from '../types';
import { writeFileAtomically, type AtomicFileDeps } from './atomic';
import { createLockRegistry } from './mutex';

const fileLocks = createLockRegistry();
const BACKUP_GENERATIONS = 7;

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
				throw new HubValidationError([
					{
						path: [],
						message: `Arquivo não encontrado: ${fullPath}. Crie o arquivo ou ajuste HUB_DATA_DIR.`
					}
				]);
			}
			throw error;
		}

		try {
			return JSON.parse(raw);
		} catch (error) {
			throw new HubValidationError([
				{
					path: [],
					message: `JSON inválido em ${fullPath}: ${(error as Error).message}`
				}
			]);
		}
	}

	private async loadFromBackup<T>(file: string, parse: (input: unknown) => T): Promise<T | null> {
		for (let index = 0; index < BACKUP_GENERATIONS; index += 1) {
			const suffix = index === 0 ? '' : `.${index}`;
			try {
				return parse(await this.readJson(`${file}.bak${suffix}`));
			} catch {
				// tenta a geração seguinte
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
		return this.writeJsonAtomic('hub.json', parseHub(data), (value) => {
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
		return parseHub(await this.readJson('hub.json'));
	}

	async loadHubFromBackup(): Promise<HubData | null> {
		return this.loadFromBackup('hub.json', parseHub);
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
		try {
			return parseHubState(await this.readJson('estado.json'));
		} catch (error) {
			if (isMissingFile(error)) {
				return structuredClone(EMPTY_STATE);
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
			return parseFeedCache(await this.readJson('feed-cache.json'));
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

		if (mode === 'replace') {
			await this.saveHub(incoming);
			if (incomingState) await this.saveState(incomingState);
			return;
		}

		let current: HubData;
		try {
			current = await this.loadHub();
		} catch (error) {
			if (!(error instanceof HubValidationError)) throw error;

			const backup = await this.loadHubFromBackup();
			if (!backup) {
				throw new HubValidationError([
					...error.issues,
					{
						path: [],
						message:
							'Importação mesclada cancelada: o hub.json atual é inválido e não há backup válido.'
					}
				]);
			}
			current = backup;
		}

		await this.saveHub(mergeByIdAll(current, incoming, options.settingsPolicy ?? 'keep'));

		if (incomingState) {
			const state = await this.loadState();
			const mergedSaved = [...new Set([...state.saved, ...incomingState.saved])];
			const savedItems = { ...state.savedItems, ...incomingState.savedItems };
			for (const id of Object.keys(savedItems)) {
				if (!mergedSaved.includes(id)) delete savedItems[id];
			}

			await this.saveState({
				version: 1,
				read: { ...state.read, ...incomingState.read },
				saved: mergedSaved,
				savedItems
			});
		}
	}

	async backupNow(): Promise<BackupCreated> {
		const createdAt = new Date();
		const stamp = createdAt.toISOString().replace(/[:.]/g, '-');
		const directory = join(this.dataDir, 'backups', `manual-${stamp}`);
		await mkdir(directory, { recursive: true });

		const files: string[] = [];
		for (const file of ['hub.json', 'estado.json', 'feed-cache.json']) {
			for (const suffix of ['', '.bak']) {
				try {
					await copyFile(this.path(file + suffix), join(directory, file + suffix));
					files.push(file + suffix);
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

		return { directory, createdAt: createdAt.toISOString(), files };
	}

	async backupInfo(): Promise<BackupInfo> {
		let lastAutomaticAt: string | null;
		try {
			lastAutomaticAt = (await stat(`${this.path('hub.json')}.bak`)).mtime.toISOString();
		} catch {
			lastAutomaticAt = null;
		}

		let lastManualAt: string | null = null;
		try {
			const backupsDir = join(this.dataDir, 'backups');
			const entries = await readdir(backupsDir, { withFileTypes: true });
			const manual = entries
				.filter((entry) => entry.isDirectory() && entry.name.startsWith('manual-'))
				.map((entry) => entry.name)
				.sort();
			const newest = manual.at(-1);
			if (newest) {
				lastManualAt = (await stat(join(backupsDir, newest))).mtime.toISOString();
			}
		} catch {
			lastManualAt = null;
		}

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
			lastManualAt,
			generations,
			retention: BACKUP_GENERATIONS
		};
	}
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
