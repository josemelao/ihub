import { startScheduler } from '#lib/feed/scheduler';
import { HubValidationError } from '#lib/schema';
import { getStorage } from '#lib/storage';
import type { HubData, ValidationIssue } from '#lib/types';
import type { LayoutServerLoad } from './$types';

const EMPTY_HUB: HubData = {
	version: 1,
	settings: { accent: '#8AA4FF' },
	categories: [],
	groups: [],
	items: [],
	feedSources: [],
	savedFilters: []
};

export const load: LayoutServerLoad = async () => {
	const storage = getStorage();
	startScheduler();

	let hub: HubData;
	let dataError: {
		message: string;
		issues: ValidationIssue[];
		usingBackup: boolean;
	} | null = null;

	try {
		hub = await storage.loadHub();
	} catch (error) {
		if (!(error instanceof HubValidationError)) throw error;

		const backup = await storage.loadHubFromBackup();
		hub = backup ?? EMPTY_HUB;
		dataError = {
			message: error.message,
			issues: error.issues,
			usingBackup: backup !== null
		};
	}

	const [state, feed] = await Promise.all([storage.loadState(), storage.loadFeedCache()]);

	return { hub, dataError, state, feed };
};
