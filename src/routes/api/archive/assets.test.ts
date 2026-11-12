import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeArchiveAssets } from '#lib/archive/store';
import type { GET } from './[id]/assets/[name]/+server';

const ASSET = 'a1b2c3d4e5f60718.png';

let dir: string;
let get: typeof GET;

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'ihub-archive-assets-'));
	process.env.HUB_DATA_DIR = dir;
	await writeArchiveAssets(join(dir, 'archive', 'abc'), [
		{ name: ASSET, bytes: new Uint8Array([1, 2]), contentType: 'image/png' }
	]);
	({ GET: get } = await import('./[id]/assets/[name]/+server'));
});

afterAll(async () => {
	delete process.env.HUB_DATA_DIR;
	await rm(dir, { recursive: true, force: true });
});

function event(id: string, name: string): Parameters<typeof get>[0] {
	return { params: { id, name } } as unknown as Parameters<typeof get>[0];
}

describe('GET /api/archive/[id]/assets/[name]', () => {
	it('serve o asset com content-type', async () => {
		const response = await get(event('abc', ASSET));

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('image/png');
		expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1, 2]);
	});

	it('400 para nome com traversal', async () => {
		expect((await get(event('abc', '../x.png'))).status).toBe(400);
	});

	it('404 para asset ausente', async () => {
		expect((await get(event('abc', 'ffffffffffffffff.png'))).status).toBe(404);
	});
});
