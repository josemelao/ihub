import { describe, expect, it, vi } from 'vitest';
import { createRefreshJobs } from './jobs';
import type { RefreshResult } from './refresh';

const result = (sourceId: string, ok = true): RefreshResult => ({
	sourceId,
	name: sourceId,
	ok,
	count: 1,
	skipped: false,
	durationMs: 1
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function setup() {
	let finish!: () => void;
	const wait = new Promise<void>((resolve) => {
		finish = resolve;
	});
	let progress: (result: RefreshResult, done: number, total: number) => void = () => undefined;

	const run = vi.fn(
		async (onSourceDone: (result: RefreshResult, done: number, total: number) => void) => {
			progress = onSourceDone;
			await wait;
		}
	);

	const jobs = createRefreshJobs({ run, count: async () => 3 });

	return {
		jobs,
		run,
		finish: () => finish(),
		report: (r: RefreshResult, d: number, t: number) => progress(r, d, t)
	};
}

describe('refresh jobs', () => {
	it('inicia em running com o total de fontes', async () => {
		const { jobs } = setup();

		const job = await jobs.start();

		expect(job.status).toBe('running');
		expect(job.total).toBe(3);
		expect(job.done).toBe(0);
	});

	it('acompanha o progresso por fonte', async () => {
		const { jobs, report, finish } = setup();
		const job = await jobs.start();
		await sleep(0);

		report(result('a'), 1, 3);
		report(result('b', false), 2, 3);

		const view = jobs.get(job.id);
		expect(view).toMatchObject({ done: 2, total: 3 });
		expect(view?.results).toHaveLength(2);

		finish();
		await sleep(0);
		await sleep(0);
		expect(jobs.get(job.id)?.status).toBe('done');
	});

	it('marca erro quando a execução falha', async () => {
		const jobs = createRefreshJobs({
			run: async () => {
				throw new Error('rede caiu');
			},
			count: async () => 1
		});

		const job = await jobs.start();
		await sleep(0);
		await sleep(0);

		const view = jobs.get(job.id);
		expect(view?.status).toBe('error');
		expect(view?.error).toMatch(/rede caiu/);
	});

	it('devolve null para job desconhecido', () => {
		const { jobs } = setup();

		expect(jobs.get('nao-existe')).toBeNull();
	});

	it('remove jobs antigos já concluídos', async () => {
		let now = 1_000;
		const jobs = createRefreshJobs({
			run: async () => undefined,
			count: async () => 1,
			now: () => now,
			retentionMs: 100
		});

		const first = await jobs.start();
		await sleep(0);
		await sleep(0);
		now += 500;

		await jobs.start();

		expect(jobs.get(first.id)).toBeNull();
	});
});
