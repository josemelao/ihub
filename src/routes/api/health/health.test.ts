import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EMPTY_HUB } from '#lib/defaults';
import { handle } from '../../../hooks.server';
import { JsonFileStorage } from '#lib/storage/json-file';
import type { GET as HealthGet } from './+server';

let dir: string;
let healthGet: typeof HealthGet;

function eventFor(url: string, init?: RequestInit) {
	return {
		request: new Request(url, init),
		url: new URL(url)
	} as unknown as Parameters<typeof handle>[0]['event'];
}

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'meu-hub-health-'));
	process.env.HUB_DATA_DIR = dir;
	await new JsonFileStorage(dir).saveHub(EMPTY_HUB);
	({ GET: healthGet } = await import('./+server'));
});

afterAll(async () => {
	delete process.env.HUB_DATA_DIR;
	delete process.env.HUB_API_TOKEN;
	await rm(dir, { recursive: true, force: true });
});

describe('/api/health', () => {
	it('responde a saúde sem vazar segredos', async () => {
		const response = await healthGet({} as Parameters<typeof healthGet>[0]);
		const body = (await response.json()) as Record<string, unknown> & {
			counts: Record<string, number>;
		};

		expect(response.status).toBe(200);
		expect(body.ok).toBe(true);
		expect(body.counts.items).toBe(0);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(JSON.stringify(body)).not.toMatch(/token|senha|secret/i);
	});
});

describe('token opcional na API', () => {
	it('sem HUB_API_TOKEN, POST passa', async () => {
		const response = await handle({
			event: eventFor('http://127.0.0.1/api/health', { method: 'POST' }),
			resolve: async () => new Response('ok', { status: 200 })
		});

		expect(response.status).toBe(200);
	});

	it('com token, POST sem Authorization recebe 401', async () => {
		process.env.HUB_API_TOKEN = 'segredo-local';
		try {
			const response = await handle({
				event: eventFor('http://127.0.0.1/api/hub', { method: 'POST' }),
				resolve: async () => new Response('não deveria rodar')
			});

			expect(response.status).toBe(401);
			await expect(response.json()).resolves.toMatchObject({ ok: false });
		} finally {
			delete process.env.HUB_API_TOKEN;
		}
	});

	it('com token, Bearer correto passa e GET continua livre', async () => {
		process.env.HUB_API_TOKEN = 'segredo-local';
		try {
			const authorized = await handle({
				event: eventFor('http://127.0.0.1/api/hub', {
					method: 'POST',
					headers: { authorization: 'Bearer segredo-local' }
				}),
				resolve: async () => new Response('ok')
			});
			const get = await handle({
				event: eventFor('http://127.0.0.1/api/hub'),
				resolve: async () => new Response('ok')
			});

			expect(authorized.status).toBe(200);
			expect(get.status).toBe(200);
		} finally {
			delete process.env.HUB_API_TOKEN;
		}
	});
});
