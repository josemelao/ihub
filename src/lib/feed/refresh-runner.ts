import type { FeedCache, HubData } from '../types';
import type { RefreshOutcome } from './refresh';

export interface RefreshRequest {
	force?: boolean;
	sourceId?: string;
}

export interface RefreshRunnerDeps {
	loadHub(): Promise<HubData>;
	refresh(
		hub: HubData,
		cache: FeedCache,
		options: { force: boolean; sourceId?: string }
	): Promise<RefreshOutcome>;
	updateFeedCache(fn: (cache: FeedCache) => Promise<FeedCache>): Promise<FeedCache>;
}

export interface RefreshRunner {
	run(request?: RefreshRequest): Promise<RefreshOutcome>;
}

/**
 * Executa no máximo um refresh por chave ("global" ou "source:<id>") por vez.
 * Chamadas concorrentes recebem a mesma promise em vez de disparar fetches
 * duplicados e brigar pela escrita do cache.
 */
export function createRefreshRunner(deps: RefreshRunnerDeps): RefreshRunner {
	const inFlight = new Map<string, Promise<RefreshOutcome>>();

	async function execute(request: { force: boolean; sourceId?: string }): Promise<RefreshOutcome> {
		const hub = await deps.loadHub();
		let outcome: RefreshOutcome | null = null;

		await deps.updateFeedCache(async (cache) => {
			outcome = await deps.refresh(hub, cache, {
				force: request.force,
				sourceId: request.sourceId
			});
			return outcome.cache;
		});

		if (!outcome) throw new Error('O refresh não produziu resultado.');
		return outcome;
	}

	return {
		run(request = {}) {
			const sourceId = request.sourceId;
			const key = sourceId ? `source:${sourceId}` : 'global';
			const existing = inFlight.get(key);
			if (existing) return existing;

			const promise = execute({ force: request.force ?? false, sourceId }).finally(() => {
				inFlight.delete(key);
			});
			inFlight.set(key, promise);
			return promise;
		}
	};
}
