import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DELETE, GET, POST } from './+server';

let dir: string;

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'meu-hub-usage-route-'));
	process.env.HUB_DATA_DIR = dir;

	const hub = {
		version: 1,
		settings: { accent: '#8AA4FF' },
		categories: [{ id: 'cat', name: 'Categoria', color: '#8AA4FF', order: 1 }],
		groups: [],
		items: [
			{
				id: 'link-a',
				type: 'link',
				name: 'Link A',
				url: 'https://example.com/a',
				categoryId: 'cat',
				tags: [],
				pinned: false,
				order: 1
			}
		],
		feedSources: [],
		savedFilters: []
	};
	await writeFile(join(dir, 'hub.json'), `${JSON.stringify(hub, null, 2)}\n`, 'utf-8');
});

afterAll(async () => {
	delete process.env.HUB_DATA_DIR;
	await rm(dir, { recursive: true, force: true });
});

function request(body: unknown): Request {
	return new Request('http://127.0.0.1/api/usage', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

describe('/api/usage', () => {
	it('registra a abertura de um item existente', async () => {
		const response = await POST({ request: request({ id: 'link-a' }) } as never);
		expect(response.status).toBe(200);

		const body = (await response.json()) as {
			ok: boolean;
			usage: { entries: Record<string, { count: number }> };
		};
		expect(body.ok).toBe(true);
		expect(body.usage.entries['link-a'].count).toBe(1);

		const stored = (await (await GET({} as never)).json()) as {
			entries: Record<string, { count: number }>;
		};
		expect(stored.entries['link-a'].count).toBe(1);
	});

	it('rejeita item inexistente e id inválido', async () => {
		expect((await POST({ request: request({ id: 'nao-existe' }) } as never)).status).toBe(404);
		expect((await POST({ request: request({ id: '../x' }) } as never)).status).toBe(400);
	});

	it('limpa o histórico', async () => {
		const response = await DELETE({} as never);
		expect(response.status).toBe(200);
		expect(await (await GET({} as never)).json()).toEqual({ version: 1, entries: {} });
	});
});
