import { EMPTY_FEED_CACHE, EMPTY_HUB, EMPTY_STATE } from '#lib/defaults';
import { startScheduler } from '#lib/feed/scheduler';
import { backfillSavedSnapshots } from '#lib/feed/view';
import { HubValidationError } from '#lib/schema';
import { getStorage } from '#lib/storage';
import type { FeedCache, HubData, HubState, ValidationIssue } from '#lib/types';
import type { LayoutServerLoad } from './$types';

interface DataError {
	message: string;
	issues: ValidationIssue[];
	usingBackup: boolean;
}

async function loadWithBackup<T>(
	load: () => Promise<T>,
	loadBackup: () => Promise<T | null>,
	empty: () => T
): Promise<{ value: T; error: DataError | null }> {
	try {
		return { value: await load(), error: null };
	} catch (error) {
		if (!(error instanceof HubValidationError)) throw error;
		const backup = await loadBackup();
		return {
			value: backup ?? empty(),
			error: {
				message: error.message,
				issues: error.issues,
				usingBackup: backup !== null
			}
		};
	}
}

export const load: LayoutServerLoad = async () => {
	const storage = getStorage();
	startScheduler();

	const [hubResult, stateResult, cacheResult] = await Promise.all([
		loadWithBackup(
			() => storage.loadHub(),
			() => storage.loadHubFromBackup(),
			() => structuredClone(EMPTY_HUB)
		),
		loadWithBackup(
			() => storage.loadState(),
			() => storage.loadStateFromBackup(),
			() => structuredClone(EMPTY_STATE)
		),
		loadWithBackup(
			() => storage.loadFeedCache(),
			() => storage.loadFeedCacheFromBackup(),
			() => structuredClone(EMPTY_FEED_CACHE)
		)
	]);

	const hub: HubData = hubResult.value;
	const loadedState: HubState = stateResult.value;
	const feed: FeedCache = cacheResult.value;
	const state = backfillSavedSnapshots(hub, feed, loadedState);
	if (state !== loadedState) {
		await storage.saveState(state);
	}

	return {
		hub,
		dataError: hubResult.error,
		stateError: stateResult.error,
		cacheError: cacheResult.error,
		state,
		feed
	};
};
