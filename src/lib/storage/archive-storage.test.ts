import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonFileStorage } from './json-file';
import { EMPTY_HUB } from '../defaults';
import type { ArchiveEntry } from '../types';

const entry: ArchiveEntry = {
	id: 'abc',
	status: 'ready',
	title: 'T',
	url: 'https://e.com/a',
	bytes: 10,
	assets: 1,
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z'
};

let dir: string;
let storage: JsonFileStorage;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), 'ihub-archive-storage-'));
	storage = new JsonFileStorage(dir);
	await storage.saveHub(EMPTY_HUB);
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe('storage do arquivo', () => {
	it('grava, atualiza e lê o índice', async () => {
		await storage.saveArchiveIndex({ version: 1, entries: {} });
		const next = await storage.updateArchiveIndex((data) => ({
			...data,
			entries: { abc: entry }
		}));

		expect(next.entries.abc.status).toBe('ready');
		expect((await storage.loadArchiveIndex()).entries.abc.id).toBe('abc');
	});

	it('começa vazio quando o índice não existe', async () => {
		expect(await storage.loadArchiveIndex()).toEqual({ version: 1, entries: {} });
	});
});
