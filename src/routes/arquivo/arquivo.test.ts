import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonFileStorage } from '#lib/storage/json-file';
import { writeArchiveDocument } from '#lib/archive/store';
import type { GET } from './[id]/+server';

let dir: string;
let storage: JsonFileStorage;
let get: typeof GET;

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'ihub-archive-route-'));
	process.env.HUB_DATA_DIR = dir;
	storage = new JsonFileStorage(dir);
	await storage.saveArchiveIndex({
		version: 1,
		entries: {
			abc: {
				id: 'abc',
				status: 'ready',
				title: 'Post',
				url: 'https://e.com/a',
				bytes: 10,
				assets: 0,
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z'
			}
		}
	});
	await writeArchiveDocument(join(dir, 'archive', 'abc'), '<!doctype html><p>ok</p>');
	({ GET: get } = await import('./[id]/+server'));
});

afterAll(async () => {
	delete process.env.HUB_DATA_DIR;
	await rm(dir, { recursive: true, force: true });
});

function event(id: string): Parameters<typeof get>[0] {
	return { params: { id } } as unknown as Parameters<typeof get>[0];
}

describe('GET /arquivo/[id]', () => {
	it('serve o documento arquivado como HTML', async () => {
		const response = await get(event('abc'));

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('text/html');
		await expect(response.text()).resolves.toContain('ok');
	});

	it('404 quando não há arquivo', async () => {
		const response = await get(event('x'));

		expect(response.status).toBe(404);
		expect(response.headers.get('content-type')).toContain('text/html');
		await expect(response.text()).resolves.toContain('Arquivo não encontrado');
	});
});
