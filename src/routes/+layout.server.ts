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

	try {
		return { hub: await storage.loadHub(), dataError: null };
	} catch (error) {
		if (!(error instanceof HubValidationError)) throw error;

		const backup = await storage.loadHubFromBackup();
		const issues: ValidationIssue[] = error.issues;

		return {
			hub: backup ?? EMPTY_HUB,
			dataError: {
				message: error.message,
				issues,
				usingBackup: backup !== null
			}
		};
	}
};
