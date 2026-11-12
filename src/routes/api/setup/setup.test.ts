import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getStorage } from '#lib/storage';
import { POST } from './+server';
import type { RequestHandler } from './$types';

let dir: string;

function event(body: unknown): Parameters<RequestHandler>[0] {
	return {
		request: new Request('http://127.0.0.1/api/setup', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		}),
		url: new URL('http://127.0.0.1/api/setup')
	} as Parameters<RequestHandler>[0];
}

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'meu-hub-setup-'));
	process.env.HUB_DATA_DIR = dir;
	await mkdir(dir, { recursive: true });
});

beforeEach(async () => {
	// O singleton do storage guarda o dataDir: limpa só o conteúdo entre testes.
	await rm(join(dir, 'hub.json'), { force: true });
	await rm(join(dir, 'hub.json.bak'), { force: true });
});

afterAll(async () => {
	delete process.env.HUB_DATA_DIR;
	await rm(dir, { recursive: true, force: true });
});

describe('POST /api/setup (primeiro uso)', () => {
	it('cria o hub de exemplo quando não existe nada', async () => {
		expect(await getStorage().hasHub()).toBe(false);

		const response = await POST(event({ mode: 'example' }));

		expect(response.status).toBe(200);
		expect(await getStorage().hasHub()).toBe(true);
		const raw = JSON.parse(await readFile(join(dir, 'hub.json'), 'utf8'));
		expect(raw.categories.length).toBeGreaterThan(0);
		expect(raw.version).toBe(2);
	});

	it('cria um hub vazio quando pedido', async () => {
		const response = await POST(event({ mode: 'empty' }));

		expect(response.status).toBe(200);
		const hub = await getStorage().loadHub();
		expect(hub.categories).toEqual([]);
	});

	it('recusa rodar com hub existente (409)', async () => {
		await POST(event({ mode: 'empty' }));

		const again = await POST(event({ mode: 'empty' }));

		expect(again.status).toBe(409);
	});

	it('recusa mode inválido', async () => {
		const response = await POST(event({ mode: 'outro' }));

		expect(response.status).toBe(400);
		expect(await getStorage().hasHub()).toBe(false);
	});
});
