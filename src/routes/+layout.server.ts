import { EMPTY_FEED_CACHE, EMPTY_STATE } from '#lib/defaults';
import { startScheduler } from '#lib/feed/scheduler';
import { backfillSavedSnapshots } from '#lib/feed/view';
import { HubValidationError } from '#lib/schema';
import { pruneState } from '#lib/state-prune';
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
		storage.loadHubWithFallback(),
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

	const hub: HubData = hubResult.hub;
	const loadedState: HubState = stateResult.value;
	const feed: FeedCache = cacheResult.value;
	const backfilled = backfillSavedSnapshots(hub, feed, loadedState);
	const pruned = pruneState(backfilled);

	let state = pruned.state;
	if (pruned.changed || backfilled !== loadedState) {
		// Reaplica sobre o estado mais recente para não sobrescrever uma ação
		// que chegou entre o load e a gravação.
		state = await storage.updateState((current) => {
			const merged = backfillSavedSnapshots(hub, feed, current);
			return pruneState(merged).state;
		});
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
