import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	assertArchiveId,
	readArchiveAsset,
	readArchiveDocument,
	writeArchiveAssets,
	writeArchiveDocument,
	deleteArchiveDir
} from './store';

const ASSET = 'a1b2c3d4e5f60718.png';

let dir: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), 'ihub-archive-'));
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe('archive store', () => {
	it('grava e lê documento e assets', async () => {
		await writeArchiveDocument(dir, '<p>ok</p>');
		await writeArchiveAssets(dir, [
			{ name: ASSET, bytes: new Uint8Array([1, 2]), contentType: 'image/png' }
		]);

		expect(await readArchiveDocument(dir)).toContain('ok');
		expect([...(await readArchiveAsset(dir, ASSET))!.bytes]).toEqual([1, 2]);
		expect((await readArchiveAsset(dir, ASSET))!.contentType).toBe('image/png');
	});

	it('rejeita nome de asset com traversal', async () => {
		expect(() => assertArchiveId('../x')).toThrow();
		await expect(
			writeArchiveAssets(dir, [
				{ name: '../x.png', bytes: new Uint8Array(), contentType: 'image/png' }
			])
		).rejects.toThrow();
	});

	it('apaga a pasta inteira', async () => {
		await writeArchiveDocument(dir, '<p>ok</p>');
		await deleteArchiveDir(dir);

		expect(await readArchiveDocument(dir)).toBeNull();
	});
});
