import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonFileStorage } from './json-file';
import type { UsageData } from '../types';

const data: UsageData = {
	version: 1,
	entries: {
		a: { id: 'a', count: 3, lastOpenedAt: '2026-01-02T00:00:00.000Z' }
	}
};

let dir: string;
let storage: JsonFileStorage;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), 'meu-hub-usage-'));
	storage = new JsonFileStorage(dir);
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe('usage no storage', () => {
	it('devolve vazio quando o arquivo não existe', async () => {
		expect(await storage.loadUsage()).toEqual({ version: 1, entries: {} });
	});

	it('grava, lê e atualiza sob lock', async () => {
		await storage.saveUsage(data);
		expect(await storage.loadUsage()).toEqual(data);

		const updated = await storage.updateUsage((current) => ({
			...current,
			entries: {
				...current.entries,
				b: { id: 'b', count: 1, lastOpenedAt: '2026-01-03T00:00:00.000Z' }
			}
		}));
		expect(Object.keys(updated.entries).sort()).toEqual(['a', 'b']);
	});

	it('rejeita arquivo inválido', async () => {
		await writeFile(join(dir, 'usage.json'), '{ quebrado', 'utf-8');
		await expect(storage.loadUsage()).rejects.toThrow();
	});
});
