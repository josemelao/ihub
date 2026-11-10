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
	savedAt: string;
}

export interface HubState {
	version: number;
	read: Record<string, string>;
	saved: string[];
	savedItems: Record<string, SavedItemSnapshot>;
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

export interface ValidationIssue {
	path: (string | number)[];
	message: string;
}

export interface HubStorage {
	loadHub(): Promise<HubData>;
	saveHub(data: HubData): Promise<void>;
	loadState(): Promise<HubState>;
	saveState(state: HubState): Promise<void>;
	loadFeedCache(): Promise<FeedCache>;
	saveFeedCache(cache: FeedCache): Promise<void>;
	exportBundle(): Promise<ExportBundle>;
	importBundle(bundle: ExportBundle, mode: 'replace' | 'merge'): Promise<void>;
}
