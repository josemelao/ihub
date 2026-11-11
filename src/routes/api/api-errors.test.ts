import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EMPTY_HUB } from '#lib/defaults';
import { JsonFileStorage } from '#lib/storage/json-file';
import type { POST as HubPost } from './hub/+server';
import type { POST as StatePost } from './state/+server';
import type { POST as RestorePost } from './backup/restore/+server';

let dir: string;
let storage: JsonFileStorage;
let hubPost: typeof HubPost;
let statePost: typeof StatePost;
let restorePost: typeof RestorePost;

function event(body: unknown): unknown {
	return {
		request: new Request('http://127.0.0.1/api/teste', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	};
}

const hubEvent = (body: unknown) => event(body) as Parameters<typeof hubPost>[0];
const stateEvent = (body: unknown) => event(body) as Parameters<typeof statePost>[0];
const restoreEvent = (body: unknown) => event(body) as Parameters<typeof restorePost>[0];

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'meu-hub-api-'));
	process.env.HUB_DATA_DIR = dir;
	storage = new JsonFileStorage(dir);
	await storage.saveHub(EMPTY_HUB);
	({ POST: hubPost } = await import('./hub/+server'));
	({ POST: statePost } = await import('./state/+server'));
	({ POST: restorePost } = await import('./backup/restore/+server'));
});

afterAll(async () => {
	delete process.env.HUB_DATA_DIR;
	await rm(dir, { recursive: true, force: true });
});

describe('erros de API', () => {
	it('/api/hub responde 400 para payload nulo sem vazar erro interno', async () => {
		const response = await hubPost(hubEvent(null));
		const body = (await response.json()) as { ok: boolean; error: string };

		expect(response.status).toBe(400);
		expect(body.error).not.toMatch(/Cannot read|undefined|TypeError/);
	});

	it('/api/hub responde 400 para payload sem action', async () => {
		const response = await hubPost(hubEvent({ foo: 'bar' }));

		expect(response.status).toBe(400);
	});

	it('/api/hub mantém 400 com mensagem para ação desconhecida', async () => {
		const response = await hubPost(hubEvent({ action: 'acao-inexistente' }));
		const body = (await response.json()) as { error: string };

		expect(response.status).toBe(400);
		expect(body.error).toMatch(/desconhecida|inválida/i);
	});

	it('/api/state responde 400 para payload nulo', async () => {
		const response = await statePost(stateEvent(null));
		const body = (await response.json()) as { error: string };

		expect(response.status).toBe(400);
		expect(body.error).not.toMatch(/Cannot read|TypeError/);
	});

	it('/api/backup/restore responde 400/404 sem detalhes internos para id inexistente', async () => {
		const response = await restorePost(restoreEvent({ id: 'manual-2020-01-01T00-00-00-000Z' }));
		const body = (await response.json()) as { error: string };

		expect([400, 404]).toContain(response.status);
		expect(body.error).not.toMatch(/Cannot read|TypeError|C:\\\\/);
	});
});
