export type MatchMode = 'any' | 'all';
export type FeedSourceType = 'rss' | 'youtube' | 'reddit';

export interface HubSettings {
	accent: string;
}

export interface Category {
	id: string;
	name: string;
	color: string;
	order: number;
}

export interface Group {
	id: string;
	categoryId: string;
	name: string;
	order: number;
}

interface ItemBase {
	id: string;
	name: string;
	description?: string;
	categoryId: string;
	groupId?: string;
	tags: string[];
	pinned: boolean;
	order: number;
	icon?: string;
}

export interface LinkItem extends ItemBase {
	type: 'link';
	url: string;
}

export interface AppItem extends ItemBase {
	type: 'app';
	launch: {
		kind: 'protocol' | 'command';
		value: string;
	};
}

export type HubItem = LinkItem | AppItem;

export interface FeedSource {
	id: string;
	type: FeedSourceType;
	name: string;
	target: string;
	categoryId: string;
	groupId?: string;
	intervalMinutes: number;
	maxItems?: number;
	locale?: string;
	enabled: boolean;
	include: string[];
	exclude: string[];
	matchMode: MatchMode;
}

export interface SavedFilter {
	id: string;
	label: string;
	include: string[];
	exclude: string[];
	matchMode: MatchMode;
}

export interface HubData {
	version: number;
	settings: HubSettings;
	categories: Category[];
	groups: Group[];
	items: HubItem[];
	feedSources: FeedSource[];
	savedFilters: SavedFilter[];
}

export interface SavedItemSnapshot {
	item: FeedItem;
	sourceId: string;
	sourceName: string;
	categoryId?: string;
	categoryName?: string;
	color?: string;
	locale?: string;
	savedAt: string;
}

export interface HubState {
	version: number;
	read: Record<string, string>;
	saved: string[];
	savedItems: Record<string, SavedItemSnapshot>;
	lastPrunedAt?: string;
}

export interface FeedItem {
	id: string;
	sourceId: string;
	title: string;
	summary: string;
	url: string;
	publishedAt: string;
	thumbnail: string | null;
}

export interface FeedSourceStatus {
	lastFetchedAt: string;
	error: string | null;
	count: number;
}

export interface FeedCache {
	version: number;
	updatedAt: string;
	items: FeedItem[];
	sources: Record<string, FeedSourceStatus>;
}

export interface ExportBundle {
	hub: HubData;
	state?: HubState;
}

export interface ImportOptions {
	/** No modo mesclar, decide o que acontece com `settings`. Padrão: manter o atual. */
	settingsPolicy?: 'keep' | 'incoming';
}

export interface BackupEntry {
	id: string;
	createdAt: string;
	path: string;
	files: number;
	sizeBytes: number;
	hasHub: boolean;
	hasState: boolean;
	hasCache: boolean;
}

export interface BackupInfo {
	lastAutomaticAt: string | null;
	lastManualAt: string | null;
	generations: number;
	retention: number;
	manualRetention: number;
	root: string;
	manual: BackupEntry[];
}

export interface BackupCreated {
	directory: string;
	createdAt: string;
	files: string[];
	entry: BackupEntry;
}

export interface BackupRestoreResult {
	restored: BackupEntry;
	safety: BackupEntry;
}

export interface HubLoadError {
	message: string;
	issues: ValidationIssue[];
	usingBackup: boolean;
}

export interface HubLoadResult {
	hub: HubData;
	error: HubLoadError | null;
}

export interface ValidationIssue {
	path: (string | number)[];
	message: string;
}

export interface HubStorage {
	loadHub(): Promise<HubData>;
	loadHubFromBackup(): Promise<HubData | null>;
	/** Hub + fallback para o backup mais novo válido, sem expor a implementação. */
	loadHubWithFallback(): Promise<HubLoadResult>;
	/** Atualização read-modify-write serializada por arquivo (lock por processo). */
	updateHub(fn: (hub: HubData) => HubData | Promise<HubData>): Promise<HubData>;
	saveHub(data: HubData): Promise<void>;
	loadState(): Promise<HubState>;
	loadStateFromBackup(): Promise<HubState | null>;
	updateState(fn: (state: HubState) => HubState | Promise<HubState>): Promise<HubState>;
	updateStateWithFallback(fn: (state: HubState) => HubState | Promise<HubState>): Promise<HubState>;
	saveState(state: HubState): Promise<void>;
	loadFeedCache(): Promise<FeedCache>;
	loadFeedCacheFromBackup(): Promise<FeedCache | null>;
	updateFeedCache(fn: (cache: FeedCache) => FeedCache | Promise<FeedCache>): Promise<FeedCache>;
	/** Mantém hub e cache sob o mesmo lock (ordem estável para evitar deadlock). */
	updateHubAndCache(
		hubFn: (hub: HubData) => HubData | Promise<HubData>,
		cacheFn: ((cache: FeedCache) => FeedCache | Promise<FeedCache>) | null
	): Promise<{ hub: HubData; cache: FeedCache | null }>;
	saveFeedCache(cache: FeedCache): Promise<void>;
	exportBundle(): Promise<ExportBundle>;
	importBundle(
		bundle: ExportBundle,
		mode: 'replace' | 'merge',
		options?: ImportOptions
	): Promise<void>;
	backupNow(): Promise<BackupCreated>;
	backupInfo(): Promise<BackupInfo>;
	/** Lê um ponto manual e devolve um bundle importável. */
	loadBackupBundle(id: string): Promise<ExportBundle>;
	/** Restaura hub/estado/cache de um ponto, criando antes um ponto de segurança. */
	restoreBackup(id: string): Promise<BackupRestoreResult>;
	/** Remove um ponto manual; backups automáticos não são afetados. */
	deleteBackup(id: string): Promise<{ id: string }>;
}
