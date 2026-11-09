import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HubValidationError, parseHub } from '../schema';
import type { ExportBundle, FeedCache, HubData, HubState, HubStorage } from '../types';

const EMPTY_HUB: HubData = {
	version: 1,
	settings: { accent: '#8AA4FF' },
	categories: [],
	groups: [],
	items: [],
	feedSources: [],
	savedFilters: []
};

const EMPTY_STATE: HubState = { version: 1, read: {}, saved: [] };
const EMPTY_CACHE: FeedCache = { version: 1, updatedAt: new Date(0).toISOString(), items: [] };

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
					{ path: [], message: `Arquivo não encontrado: ${fullPath}. Crie o arquivo ou ajuste HUB_DATA_DIR.` }
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

	private async writeJsonAtomic(file: string, value: unknown): Promise<void> {
		await mkdir(this.dataDir, { recursive: true });
		const fullPath = this.path(file);
		const tempPath = `${fullPath}.tmp-${process.pid}-${Date.now()}`;
		const backupPath = `${fullPath}.bak`;

		await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
		try {
			await copyFile(fullPath, backupPath);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		}
		await rename(tempPath, fullPath);
	}

	async loadHub(): Promise<HubData> {
		return parseHub(await this.readJson('hub.json'));
	}

	async saveHub(data: HubData): Promise<void> {
		await this.writeJsonAtomic('hub.json', parseHub(data));
	}

	async loadState(): Promise<HubState> {
		try {
			const value = (await this.readJson('estado.json')) as Partial<HubState>;
			return { version: value.version ?? 1, read: value.read ?? {}, saved: value.saved ?? [] };
		} catch (error) {
			if (error instanceof HubValidationError && error.message.includes('não encontrado')) {
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
				items: value.items ?? []
			};
		} catch (error) {
			if (error instanceof HubValidationError && error.message.includes('não encontrado')) {
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
			if (bundle.state) await this.saveState(bundle.state);
			return;
		}

		let current: HubData;
		try {
			current = await this.loadHub();
		} catch (error) {
			if (error instanceof HubValidationError) current = structuredClone(EMPTY_HUB);
			else throw error;
		}

		await this.saveHub(mergeByIdAll(current, incoming));

		if (bundle.state) {
			const state = await this.loadState();
			await this.saveState({
				version: 1,
				read: { ...state.read, ...bundle.state.read },
				saved: [...new Set([...state.saved, ...bundle.state.saved])]
			});
		}
	}
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
