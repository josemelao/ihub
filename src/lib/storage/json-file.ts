import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HubValidationError, parseHub } from '../schema';
import type { ExportBundle, FeedCache, HubData, HubState, HubStorage } from '../types';

const EMPTY_STATE: HubState = { version: 1, read: {}, saved: [], savedItems: {} };
const EMPTY_CACHE: FeedCache = {
	version: 1,
	updatedAt: new Date(0).toISOString(),
	items: [],
	sources: {}
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

	private async writeJsonAtomic(
		file: string,
		value: unknown,
		validateBackup?: (value: unknown) => boolean
	): Promise<void> {
		await mkdir(this.dataDir, { recursive: true });
		const fullPath = this.path(file);
		const tempPath = `${fullPath}.tmp-${process.pid}-${Date.now()}`;
		const backupPath = `${fullPath}.bak`;

		await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
		try {
			const current = JSON.parse(await readFile(fullPath, 'utf-8'));
			if (!validateBackup || validateBackup(current)) {
				await copyFile(fullPath, backupPath);
			}
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT' && !(error instanceof SyntaxError)) {
				throw error;
			}
		}
		await rename(tempPath, fullPath);
	}

	async loadHub(): Promise<HubData> {
		return parseHub(await this.readJson('hub.json'));
	}

	async loadHubFromBackup(): Promise<HubData | null> {
		try {
			return parseHub(await this.readJson('hub.json.bak'));
		} catch {
			return null;
		}
	}

	async saveHub(data: HubData): Promise<void> {
		await this.writeJsonAtomic('hub.json', parseHub(data), (value) => {
			try {
				parseHub(value);
				return true;
			} catch {
				return false;
			}
		});
	}

	async loadState(): Promise<HubState> {
		try {
			const value = (await this.readJson('estado.json')) as Partial<HubState>;
			return {
				version: value.version ?? 1,
				read: value.read ?? {},
				saved: value.saved ?? [],
				savedItems: value.savedItems ?? {}
			};
		} catch (error) {
			if (isMissingFile(error)) {
				return structuredClone(EMPTY_STATE);
			}
			throw error;
		}
	}

	async saveState(state: HubState): Promise<void> {
		await this.writeJsonAtomic('estado.json', state);
	}

	async loadFeedCache(): Promise<FeedCache> {
		try {
			const value = (await this.readJson('feed-cache.json')) as Partial<FeedCache>;
			return {
				version: value.version ?? 1,
				updatedAt: value.updatedAt ?? EMPTY_CACHE.updatedAt,
				items: value.items ?? [],
				sources: value.sources ?? {}
			};
		} catch (error) {
			if (isMissingFile(error)) {
				return structuredClone(EMPTY_CACHE);
			}
			throw error;
		}
	}

	async saveFeedCache(cache: FeedCache): Promise<void> {
		await this.writeJsonAtomic('feed-cache.json', cache);
	}

	async exportBundle(): Promise<ExportBundle> {
		return { hub: await this.loadHub(), state: await this.loadState() };
	}

	async importBundle(bundle: ExportBundle, mode: 'replace' | 'merge'): Promise<void> {
		const incoming = parseHub(bundle.hub);

		if (mode === 'replace') {
			await this.saveHub(incoming);
			if (bundle.state) await this.saveState(normalizeState(bundle.state));
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

		await this.saveHub(mergeByIdAll(current, incoming));

		if (bundle.state) {
			const state = await this.loadState();
			const incomingState = normalizeState(bundle.state);
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
}

function normalizeState(state: HubState): HubState {
	return {
		version: state.version ?? 1,
		read: state.read ?? {},
		saved: state.saved ?? [],
		savedItems: state.savedItems ?? {}
	};
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
	const merged = new Map(current.map((entry) => [entry.id, entry]));
	for (const entry of incoming) merged.set(entry.id, entry);
	return [...merged.values()];
}

function mergeByIdAll(current: HubData, incoming: HubData): HubData {
	return {
		version: incoming.version,
		settings: incoming.settings,
		categories: mergeById(current.categories, incoming.categories),
		groups: mergeById(current.groups, incoming.groups),
		items: mergeById(current.items, incoming.items),
		feedSources: mergeById(current.feedSources, incoming.feedSources),
		savedFilters: mergeById(current.savedFilters, incoming.savedFilters)
	};
}
