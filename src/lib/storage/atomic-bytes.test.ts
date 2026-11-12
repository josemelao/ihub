import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeBytesAtomically } from './atomic';
import { nodeFileDeps } from './node-deps';

let dir: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), 'ihub-atomic-bytes-'));
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe('writeBytesAtomically', () => {
	it('grava bytes e lê de volta', async () => {
		await writeBytesAtomically(join(dir, 'a.bin'), new Uint8Array([9, 8]), nodeFileDeps);

		expect([...(await readFile(join(dir, 'a.bin')))]).toEqual([9, 8]);
	});
});
