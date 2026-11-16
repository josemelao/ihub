import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { collectBackupFiles, writeBackupZip } from './zip';

let dir: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), 'meu-hub-zip-'));

	await writeFile(join(dir, 'hub.json'), '{"version":1}\n', 'utf-8');
	await writeFile(join(dir, 'estado.json'), '{"version":1}\n', 'utf-8');
	await writeFile(join(dir, 'feed-cache.json'), '{"version":1}\n', 'utf-8');
	await writeFile(join(dir, 'notes.json'), '{"version":1,"notes":[]}\n', 'utf-8');
	await writeFile(join(dir, 'highlights.json'), '{"version":1,"highlights":[]}\n', 'utf-8');
	await writeFile(join(dir, 'archive.json'), '{"version":1,"entries":{}}\n', 'utf-8');

	await mkdir(join(dir, 'reading'), { recursive: true });
	await writeFile(join(dir, 'reading', 'post-a.json'), '{"id":"post-a"}\n', 'utf-8');

	await mkdir(join(dir, 'archive', 'post-a', 'assets'), { recursive: true });
	await writeFile(join(dir, 'archive', 'post-a', 'index.html'), '<html>post</html>\n', 'utf-8');
	await writeFile(join(dir, 'archive', 'post-a', 'assets.json'), '{"version":1}\n', 'utf-8');
	await writeFile(join(dir, 'archive', 'post-a', 'assets', 'img.png'), 'png', 'utf-8');
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe('collectBackupFiles', () => {
	it('inclui os JSONs e o texto dos artigos, sem páginas arquivadas por padrão', async () => {
		const { files, manifest } = await collectBackupFiles(dir);
		const names = files.map((file) => file.name);

		expect(names).toEqual(
			expect.arrayContaining([
				'hub.json',
				'estado.json',
				'feed-cache.json',
				'notes.json',
				'highlights.json',
				'reading/post-a.json'
			])
		);
		expect(names).not.toContain('archive.json');
		expect(names.some((name) => name.startsWith('archive/'))).toBe(false);
		expect(manifest.includesArchive).toBe(false);
		expect(manifest.counts).toEqual({ reading: 1, archive: 0 });
		expect(manifest.files).toEqual(names);
		expect(manifest.totalBytes).toBeGreaterThan(0);
	});

	it('inclui índice e arquivos das páginas arquivadas quando pedido', async () => {
		const { files, manifest } = await collectBackupFiles(dir, { includeArchive: true });
		const names = files.map((file) => file.name);

		expect(names).toEqual(
			expect.arrayContaining([
				'archive.json',
				'archive/post-a/index.html',
				'archive/post-a/assets.json',
				'archive/post-a/assets/img.png'
			])
		);
		expect(manifest.includesArchive).toBe(true);
		expect(manifest.counts.archive).toBe(3);
	});

	it('não quebra quando a pasta de dados não existe', async () => {
		const empty = join(dir, 'nao-existe');
		const { files, manifest } = await collectBackupFiles(empty);

		expect(files).toEqual([]);
		expect(manifest.files).toEqual([]);
		expect(manifest.totalBytes).toBe(0);
	});
});

describe('writeBackupZip', () => {
	it('grava um ZIP válido com manifesto e arquivos', async () => {
		const { files, manifest } = await collectBackupFiles(dir);
		const target = join(dir, 'backup.zip');

		await writeBackupZip(target, files, manifest);

		const zipped = unzipSync(new Uint8Array(await readFile(target)));
		expect(Object.keys(zipped)).toEqual(
			expect.arrayContaining(['manifest.json', 'hub.json', 'reading/post-a.json'])
		);
		const written = JSON.parse(strFromU8(zipped['manifest.json'])) as typeof manifest;
		expect(written.includesArchive).toBe(false);
		expect(written.counts.reading).toBe(1);
	});
});
