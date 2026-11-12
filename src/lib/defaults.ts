import { HUB_SCHEMA_VERSION } from './migrations/hub';
import { CACHE_SCHEMA_VERSION, STATE_SCHEMA_VERSION } from './migrations/state';
import type {
	ArchiveIndex,
	FeedCache,
	HighlightsData,
	HubData,
	HubState,
	NotesData
} from './types';

export const EMPTY_HUB: HubData = {
	version: HUB_SCHEMA_VERSION,
	settings: { accent: '#8AA4FF' },
	categories: [],
	groups: [],
	items: [],
	feedSources: [],
	savedFilters: []
};

export const EMPTY_STATE: HubState = {
	version: STATE_SCHEMA_VERSION,
	read: {},
	saved: [],
	savedItems: {}
};

export const EMPTY_FEED_CACHE: FeedCache = {
	version: CACHE_SCHEMA_VERSION,
	updatedAt: new Date(0).toISOString(),
	items: [],
	sources: {}
};

export const EMPTY_NOTES: NotesData = {
	version: 1,
	notes: []
};

export const EMPTY_HIGHLIGHTS: HighlightsData = {
	version: 1,
	highlights: []
};

export const EMPTY_ARCHIVE_INDEX: ArchiveIndex = {
	version: 1,
	entries: {}
};
