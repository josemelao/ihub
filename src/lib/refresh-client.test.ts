import { describe, expect, it, vi } from 'vitest';
import { refreshWithProgress } from './refresh-client';
import type { RefreshJobView } from './feed/jobs';

const job = (overrides: Partial<RefreshJobView>): RefreshJobView => ({
	id: 'job-1',
	status: 'running',
	total: 3,
	done: 0,
	results: [],
	startedAt: '2026-11-11T00:00:00.000Z',
	finishedAt: null,
	error: null,
	...overrides
});

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

describe('refreshWithProgress', () => {
	it('inicia o job, acompanha o progresso e devolve o resultado final', async () => {
		vi.useFakeTimers();
		try {
			const fetcher = vi
				.fn()
				.mockResolvedValueOnce(jsonResponse({ ok: true, jobId: 'job-1', total: 3 }, 202))
				.mockResolvedValueOnce(jsonResponse({ ok: true, job: job({ done: 1 }) }))
				.mockResolvedValueOnce(jsonResponse({ ok: true, job: job({ done: 3, status: 'done' }) }));

			const progress: { done: number; total: number }[] = [];
			const promise = refreshWithProgress((value) => progress.push(value), {
				fetcher: fetcher as unknown as typeof fetch,
				intervalMs: 10
			});

			await vi.advanceTimersByTimeAsync(30);
			const result = await promise;

			expect(result.status).toBe('done');
			expect(progress).toEqual([
				{ done: 0, total: 3 },
				{ done: 1, total: 3 },
				{ done: 3, total: 3 }
			]);
		} finally {
			vi.useRealTimers();
		}
	});

	it('propaga erro do job', async () => {
		vi.useFakeTimers();
		try {
			const fetcher = vi
				.fn()
				.mockResolvedValueOnce(jsonResponse({ ok: true, jobId: 'job-1', total: 1 }, 202))
				.mockResolvedValueOnce(
					jsonResponse({ ok: true, job: job({ status: 'error', error: 'rede caiu' }) })
				);

			const promise = refreshWithProgress(undefined, {
				fetcher: fetcher as unknown as typeof fetch,
				intervalMs: 10
			});
			const assertion = expect(promise).rejects.toThrow('rede caiu');

			await vi.advanceTimersByTimeAsync(20);
			await assertion;
		} finally {
			vi.useRealTimers();
		}
	});

	it('falha quando o job não inicia', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse({ ok: false, error: 'ocupado' }, 500));

		await expect(
			refreshWithProgress(undefined, { fetcher: fetcher as unknown as typeof fetch })
		).rejects.toThrow('ocupado');
	});
});
