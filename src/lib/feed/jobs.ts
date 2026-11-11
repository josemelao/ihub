import { randomUUID } from 'node:crypto';
import type { RefreshResult } from './refresh';

export type RefreshJobStatus = 'running' | 'done' | 'error';

export interface RefreshJobView {
	id: string;
	status: RefreshJobStatus;
	total: number;
	done: number;
	results: RefreshResult[];
	startedAt: string;
	finishedAt: string | null;
	error: string | null;
}

interface RefreshJob extends RefreshJobView {
	startedMs: number;
}

export interface RefreshJobsDeps {
	/** Executa o refresh, chamando `onSourceDone` a cada fonte concluída. */
	run(onSourceDone: (result: RefreshResult, done: number, total: number) => void): Promise<void>;
	/** Total de fontes que serão processadas (para a barra de progresso). */
	count(): Promise<number>;
	now?: () => number;
	/** Quanto tempo um job concluído fica disponível para consulta. */
	retentionMs?: number;
}

export interface RefreshJobs {
	start(): Promise<RefreshJobView>;
	get(id: string): RefreshJobView | null;
}

const DEFAULT_RETENTION_MS = 10 * 60 * 1000;

function viewOf(job: RefreshJob): RefreshJobView {
	return {
		id: job.id,
		status: job.status,
		total: job.total,
		done: job.done,
		results: job.results,
		startedAt: job.startedAt,
		finishedAt: job.finishedAt,
		error: job.error
	};
}

/**
 * Registry em memória dos refreshes assíncronos. O scheduler continua sendo o
 * ponto único de execução; o job só observa o progresso por fonte.
 */
export function createRefreshJobs(deps: RefreshJobsDeps): RefreshJobs {
	const now = deps.now ?? (() => Date.now());
	const retentionMs = deps.retentionMs ?? DEFAULT_RETENTION_MS;
	const jobs = new Map<string, RefreshJob>();

	function prune(): void {
		const limit = now() - retentionMs;
		for (const [id, job] of jobs) {
			if (job.status !== 'running' && job.finishedAt) {
				if (Date.parse(job.finishedAt) < limit) jobs.delete(id);
			}
		}
	}

	return {
		async start() {
			prune();

			// Já existe refresh global em andamento: devolve o mesmo job para o
			// progresso não se perder num segundo registro vazio.
			for (const job of jobs.values()) {
				if (job.status === 'running') return viewOf(job);
			}

			const startedMs = now();
			const total = await deps.count();
			const job: RefreshJob = {
				id: randomUUID(),
				status: 'running',
				total,
				done: 0,
				results: [],
				startedAt: new Date(startedMs).toISOString(),
				finishedAt: null,
				error: null,
				startedMs
			};
			jobs.set(job.id, job);

			void (async () => {
				try {
					await deps.run((result, done, currentTotal) => {
						job.done = done;
						job.total = currentTotal;
						job.results.push(result);
					});
					job.status = 'done';
				} catch (error) {
					job.status = 'error';
					job.error = error instanceof Error ? error.message : String(error);
				} finally {
					job.finishedAt = new Date(now()).toISOString();
				}
			})();

			return viewOf(job);
		},

		get(id) {
			const job = jobs.get(id);
			return job ? viewOf(job) : null;
		}
	};
}
