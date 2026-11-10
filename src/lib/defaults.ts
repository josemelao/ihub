import type { FeedCache, HubData, HubState } from './types';

export const EMPTY_HUB: HubData = {
	version: 1,
	settings: { accent: '#8AA4FF' },
	categories: [],
	groups: [],
	items: [],
	feedSources: [],
	savedFilters: []
};

export const EMPTY_STATE: HubState = {
	version: 1,
	read: {},
	saved: [],
	savedItems: {}
};

export const EMPTY_FEED_CACHE: FeedCache = {
	version: 1,
	updatedAt: new Date(0).toISOString(),
	items: [],
	sources: {}
};
