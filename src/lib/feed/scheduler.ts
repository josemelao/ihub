import { getStorage } from '../storage';
import { refreshFeed, type RefreshOutcome } from './refresh';

const SCHEDULER_KEY = Symbol.for('meu-hub.feed-scheduler');
const RUNNING_KEY = Symbol.for('meu-hub.feed-running');

type GlobalWithState = typeof globalThis & {
	[SCHEDULER_KEY]?: ReturnType<typeof setInterval>;
	[RUNNING_KEY]?: boolean;
};

const globalState = globalThis as GlobalWithState;

export async function refreshAndSave(force = false, sourceId?: string): Promise<RefreshOutcome> {
	const storage = getStorage();
	const hub = await storage.loadHub();
	const cache = await storage.loadFeedCache();
	const outcome = await refreshFeed(hub, cache, { force, sourceId });
	await storage.saveFeedCache(outcome.cache);
	return outcome;
}

async function scheduledRun(): Promise<void> {
	if (globalState[RUNNING_KEY]) return;
	globalState[RUNNING_KEY] = true;
	try {
		await refreshAndSave(false);
	} catch (error) {
		console.error('[feed] falha na atualização periódica:', error);
	} finally {
		globalState[RUNNING_KEY] = false;
	}
}

export function startScheduler(intervalMs = 60_000): void {
	if (globalState[SCHEDULER_KEY]) return;

	globalState[SCHEDULER_KEY] = setInterval(() => {
		void scheduledRun();
	}, intervalMs);

	setTimeout(() => {
		void scheduledRun();
	}, 3_000);
}
