import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unzipSync } from 'fflate';
import { GET } from './+server';

let dir: string;
let previous: string | undefined;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), 'meu-hub-zip-route-'));
	previous = process.env.HUB_DATA_DIR;
	process.env.HUB_DATA_DIR = dir;

	await writeFile(join(dir, 'hub.json'), '{"version":1}\n', 'utf-8');
	await writeFile(join(dir, 'estado.json'), '{"version":1}\n', 'utf-8');
	await writeFile(join(dir, 'notes.json'), '{"version":1,"notes":[]}\n', 'utf-8');
	await mkdir(join(dir, 'reading'), { recursive: true });
	await writeFile(join(dir, 'reading', 'post-a.json'), '{"id":"post-a"}\n', 'utf-8');
	await mkdir(join(dir, 'archive', 'post-a'), { recursive: true });
	await writeFile(join(dir, 'archive', 'post-a', 'index.html'), '<html>post</html>\n', 'utf-8');
});

afterEach(async () => {
	if (previous === undefined) delete process.env.HUB_DATA_DIR;
	else process.env.HUB_DATA_DIR = previous;
	await rm(dir, { recursive: true, force: true });
});

async function call(path: string): Promise<Response> {
	return GET({ url: new URL(`http://127.0.0.1${path}`) } as never);
}

describe('GET /api/backup/zip', () => {
	it('baixa um ZIP com os dados e sem as páginas arquivadas por padrão', async () => {
		const response = await call('/api/backup/zip');
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('application/zip');
		expect(response.headers.get('content-disposition')).toContain('.zip');

		const zipped = unzipSync(new Uint8Array(await response.arrayBuffer()));
		const names = Object.keys(zipped);

		expect(names).toEqual(
			expect.arrayContaining(['manifest.json', 'hub.json', 'estado.json', 'reading/post-a.json'])
		);
		expect(names.some((name) => name.startsWith('archive/'))).toBe(false);
	});

	it('inclui as páginas arquivadas com ?arquivos=1', async () => {
		const response = await call('/api/backup/zip?arquivos=1');
		const zipped = unzipSync(new Uint8Array(await response.arrayBuffer()));

		expect(Object.keys(zipped)).toEqual(expect.arrayContaining(['archive/post-a/index.html']));
	});
});
