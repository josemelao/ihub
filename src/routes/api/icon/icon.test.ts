import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getOrFetchIcon, iconCacheKey } from '#lib/icons/cache';
import { GET } from './+server';

let dir: string;

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'meu-hub-icon-route-'));
	process.env.HUB_DATA_DIR = dir;
});

afterAll(async () => {
	delete process.env.HUB_DATA_DIR;
	await rm(dir, { recursive: true, force: true });
});

async function call(query: string): Promise<Response> {
	return GET({ url: new URL(`http://127.0.0.1/api/icon?${query}`) } as never);
}

describe('GET /api/icon', () => {
	it('serve o ícone que já está no cache', async () => {
		await getOrFetchIcon(dir, 'https://example.com', {
			fetchBytes: async () => ({ bytes: new Uint8Array([9, 8, 7]), contentType: 'image/png' })
		});

		const response = await call('url=https%3A%2F%2Fexample.com');
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('image/png');
		expect(response.headers.get('cache-control')).toContain('immutable');
		expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([9, 8, 7]);
	});

	it('devolve 404 para miss recente sem tentar a rede', async () => {
		const source = 'https://sem-icone.example';
		const key = iconCacheKey(source)!;
		await mkdir(join(dir, 'icons'), { recursive: true });
		await writeFile(
			join(dir, 'icons', `${key}.miss`),
			JSON.stringify({ source, checkedAt: new Date().toISOString() }),
			'utf-8'
		);

		const response = await call(`url=${encodeURIComponent(source)}`);
		expect(response.status).toBe(404);
	});

	it('rejeita url ausente ou inválida', async () => {
		expect((await call('')).status).toBe(400);
		expect((await call(`url=${encodeURIComponent('file:///c:/a.png')}`)).status).toBe(400);
	});
});
