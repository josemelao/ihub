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
	const inFlight = new Map<string, { promise: Promise<RefreshOutcome>; force: boolean }>();

	async function execute(request: { force: boolean; sourceId?: string }): Promise<RefreshOutcome> {
		let outcome: RefreshOutcome | null = null;

		await deps.updateFeedCache(async (cache) => {
			// O hub é lido sob o lock do cache: uma remoção/troca de fonte precisa
			// do mesmo lock, então o refresh nunca ressuscita itens de fonte removida.
			const hub = await deps.loadHub();
			outcome = await deps.refresh(hub, cache, {
				force: request.force,
				sourceId: request.sourceId
			});
			return outcome.cache;
		});

		if (!outcome) throw new Error('O refresh não produziu resultado.');
		return outcome;
	}

	function start(
		key: string,
		request: { force: boolean; sourceId?: string }
	): Promise<RefreshOutcome> {
		const entry = {
			force: request.force
		} as { promise: Promise<RefreshOutcome>; force: boolean };
		entry.promise = execute(request).finally(() => {
			if (inFlight.get(key) === entry) inFlight.delete(key);
		});
		inFlight.set(key, entry);
		return entry.promise;
	}

	return {
		run(request = {}) {
			const sourceId = request.sourceId;
			const key = sourceId ? `source:${sourceId}` : 'global';
			const force = request.force ?? false;
			const existing = inFlight.get(key);

			if (!existing) return start(key, { force, sourceId });
			// Pedido comum espera o que já está rodando; forçado só é engolido
			// quando a execução em andamento também é forçada.
			if (!force || existing.force) return existing.promise;

			const queued = {
				force: true,
				promise: existing.promise
					.then(
						() => undefined,
						() => undefined
					)
					.then(() => start(key, { force: true, sourceId }))
			};
			inFlight.set(key, queued);
			return queued.promise;
		}
	};
}
