export type MatchMode = 'any' | 'all';
export type FeedSourceType = 'rss' | 'youtube' | 'reddit';

export interface HubSettings {
	accent: string;
	/** Ordem manual dos itens fixados no Acesso rápido. */
	quickAccessOrder?: string[];
	/** Quantos atalhos mostrar (3–12). */
	quickAccessLimit?: number;
	/** Densidade da interface. */
	density?: 'comfortable' | 'compact';
	/** Tamanho base do texto (13–15 px). */
	fontSize?: 13 | 14 | 15;
	/** Contraste alto para leitura. */
	highContrast?: boolean;
	/** Notificar no sistema quando chegarem posts novos. */
	notifyUnread?: boolean;
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

export interface HubNote {
	id: string;
	text: string;
	createdAt: string;
	updatedAt: string;
	pinned?: boolean;
}

export interface NotesData {
	version: number;
	notes: HubNote[];
}

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink';

export interface ReadingArticle {
	id: string;
	url: string;
	finalUrl: string;
	title: string;
	byline: string;
	siteName: string;
	excerpt: string;
	publishedAt: string;
	fetchedAt: string;
	length: number;
	/** HTML sanitizado; nunca vem direto da rede. */
	html: string;
	text: string;
}

export interface ReadingHighlight {
	id: string;
	itemId: string;
	itemTitle: string;
	itemUrl: string;
	quote: string;
	note?: string;
	color: HighlightColor;
	/** Ordinal da enésima ocorrência idêntica da quote no texto (0-based). */
	occurrence: number;
	createdAt: string;
	updatedAt: string;
}

export interface HighlightsData {
	version: number;
	highlights: ReadingHighlight[];
}

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
	/** Ordem de exibição dentro da categoria; normalizada no load. */
	order?: number;
	/** Extrair texto completo no reader (fontes RSS). */
	fullText?: boolean;
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
	categoryId?: string | null;
	sourceId?: string | null;
	unreadOnly?: boolean;
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
	notes?: NotesData;
	highlights?: HighlightsData;
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

export interface StateRecoveryInfo {
	removedSnapshots: number;
	removedRead: number;
	removedSaved: number;
}

export interface StateLoadResult {
	state: HubState;
	/** Preenchido quando parte do estado inválido foi descartada na leitura. */
	recovery: StateRecoveryInfo | null;
}

export interface ValidationIssue {
	path: (string | number)[];
	message: string;
}

export interface HubStorage {
	loadHub(): Promise<HubData>;
	loadHubFromBackup(): Promise<HubData | null>;
	/** `true` quando `hub.json` existe (primeiro uso). */
	hasHub(): Promise<boolean>;
	/** Hub + fallback para o backup mais novo válido, sem expor a implementação. */
	loadHubWithFallback(): Promise<HubLoadResult>;
	/** Atualização read-modify-write serializada por arquivo (lock por processo). */
	updateHub(fn: (hub: HubData) => HubData | Promise<HubData>): Promise<HubData>;
	saveHub(data: HubData): Promise<void>;
	loadState(): Promise<HubState>;
	loadStateWithRecovery(): Promise<StateLoadResult>;
	loadStateFromBackup(): Promise<HubState | null>;
	updateState(fn: (state: HubState) => HubState | Promise<HubState>): Promise<HubState>;
	updateStateWithFallback(fn: (state: HubState) => HubState | Promise<HubState>): Promise<HubState>;
	saveState(state: HubState): Promise<void>;
	loadFeedCache(): Promise<FeedCache>;
	loadFeedCacheFromBackup(): Promise<FeedCache | null>;
	updateFeedCache(fn: (cache: FeedCache) => FeedCache | Promise<FeedCache>): Promise<FeedCache>;
	loadNotes(): Promise<NotesData>;
	loadNotesFromBackup(): Promise<NotesData | null>;
	updateNotes(fn: (notes: NotesData) => NotesData | Promise<NotesData>): Promise<NotesData>;
	saveNotes(data: NotesData): Promise<void>;
	loadArticle(id: string): Promise<ReadingArticle | null>;
	saveArticle(article: ReadingArticle): Promise<void>;
	deleteArticle(id: string): Promise<void>;
	loadHighlights(): Promise<HighlightsData>;
	loadHighlightsFromBackup(): Promise<HighlightsData | null>;
	updateHighlights(
		fn: (data: HighlightsData) => HighlightsData | Promise<HighlightsData>
	): Promise<HighlightsData>;
	saveHighlights(data: HighlightsData): Promise<void>;
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
