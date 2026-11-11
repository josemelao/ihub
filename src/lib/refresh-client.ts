import type { RefreshJobView } from './feed/jobs';

export interface RefreshProgress {
	done: number;
	total: number;
}

export interface RefreshClientOptions {
	intervalMs?: number;
	fetcher?: typeof fetch;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Dispara o refresh assíncrono e acompanha `done/total` até terminar.
 * Lança erro com a mensagem do servidor quando o job falha.
 */
export async function refreshWithProgress(
	onProgress?: (progress: RefreshProgress) => void,
	options: RefreshClientOptions = {}
): Promise<RefreshJobView> {
	const fetcher = options.fetcher ?? fetch;
	const intervalMs = options.intervalMs ?? 800;

	const started = await fetcher('/api/refresh', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ async: true })
	});
	const startBody = (await started.json()) as {
		ok?: boolean;
		jobId?: string;
		total?: number;
		error?: string;
	};

	if (!started.ok || !startBody.jobId) {
		throw new Error(startBody.error ?? 'Não foi possível iniciar a atualização.');
	}

	const jobId = startBody.jobId;
	onProgress?.({ done: 0, total: startBody.total ?? 0 });

	for (;;) {
		await sleep(intervalMs);
		const response = await fetcher(`/api/refresh/status?id=${encodeURIComponent(jobId)}`);
		const body = (await response.json()) as {
			ok?: boolean;
			job?: RefreshJobView;
			error?: string;
		};

		if (!response.ok || !body.job) {
			throw new Error(body.error ?? 'Falha ao consultar o progresso da atualização.');
		}

		onProgress?.({ done: body.job.done, total: body.job.total });

		if (body.job.status === 'running') continue;
		if (body.job.status === 'error') {
			throw new Error(body.job.error ?? 'Falha ao atualizar o feed.');
		}
		return body.job;
	}
}
