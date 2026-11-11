import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EMPTY_HUB } from '#lib/defaults';
import { JsonFileStorage } from '#lib/storage/json-file';
import type { POST as RefreshPost } from './+server';
import type { GET as StatusGet } from './status/+server';

let dir: string;
let refreshPost: typeof RefreshPost;
let statusGet: typeof StatusGet;

function postEvent(body: unknown): Parameters<typeof refreshPost>[0] {
	return {
		request: new Request('http://127.0.0.1/api/refresh', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		}),
		url: new URL('http://127.0.0.1/api/refresh')
	} as unknown as Parameters<typeof refreshPost>[0];
}

function statusEvent(url: string): Parameters<typeof statusGet>[0] {
	return { url: new URL(url) } as unknown as Parameters<typeof statusGet>[0];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'meu-hub-refresh-job-'));
	process.env.HUB_DATA_DIR = dir;
	await new JsonFileStorage(dir).saveHub(EMPTY_HUB);
	({ POST: refreshPost } = await import('./+server'));
	({ GET: statusGet } = await import('./status/+server'));
});

afterAll(async () => {
	delete process.env.HUB_DATA_DIR;
	await rm(dir, { recursive: true, force: true });
});

describe('refresh assíncrono', () => {
	it('inicia um job e permite consultar o progresso', async () => {
		const response = await refreshPost(postEvent({ async: true }));
		const started = (await response.json()) as { ok: boolean; jobId: string };

		expect(response.status).toBe(202);
		expect(started.jobId).toBeTruthy();

		let status = 'running';
		for (let attempts = 0; attempts < 20 && status === 'running'; attempts += 1) {
			await sleep(10);
			const poll = await statusGet(
				statusEvent(`http://127.0.0.1/api/refresh/status?id=${started.jobId}`)
			);
			const body = (await poll.json()) as { job: { status: string; done: number; total: number } };
			status = body.job.status;
		}

		expect(status).toBe('done');
	});

	it('mantém o POST síncrono quando async não é pedido', async () => {
		const response = await refreshPost(postEvent({}));
		const body = (await response.json()) as { ok: boolean; results: unknown[] };

		expect(response.status).toBe(200);
		expect(body.ok).toBe(true);
		expect(body.results).toEqual([]);
	});

	it('responde 400 sem id e 404 para job desconhecido', async () => {
		const missing = await statusGet(statusEvent('http://127.0.0.1/api/refresh/status'));
		expect(missing.status).toBe(400);

		const unknown = await statusGet(
			statusEvent('http://127.0.0.1/api/refresh/status?id=nao-existe')
		);
		expect(unknown.status).toBe(404);
	});
});
