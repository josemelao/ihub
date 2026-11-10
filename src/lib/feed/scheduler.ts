import { getStorage } from '../storage';
import { refreshFeed, type RefreshOutcome } from './refresh';
import { createRefreshRunner, type RefreshRequest } from './refresh-runner';

const SCHEDULER_KEY = Symbol.for('meu-hub.feed-scheduler');

type GlobalWithState = typeof globalThis & {
	[SCHEDULER_KEY]?: ReturnType<typeof setInterval>;
};

const globalState = globalThis as GlobalWithState;

const runner = createRefreshRunner({
	loadHub: () => getStorage().loadHub(),
	refresh: (hub, cache, options) => refreshFeed(hub, cache, options),
	updateFeedCache: (fn) => getStorage().updateFeedCache(fn)
});

/**
 * Ponto único de refresh: scheduler e `/api/refresh` passam por aqui.
 * Chamadas simultâneas para a mesma chave são coalescidas.
 */
export function runRefresh(request: RefreshRequest = {}): Promise<RefreshOutcome> {
	return runner.run(request);
}

export function refreshAndSave(force = false, sourceId?: string): Promise<RefreshOutcome> {
	return runRefresh({ force, sourceId });
}

async function scheduledRun(): Promise<void> {
	try {
		await runRefresh();
	} catch (error) {
		console.error('[feed] falha na atualização periódica:', error);
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
