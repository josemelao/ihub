import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonFileStorage } from './json-file';
import type { LinkHealthData } from '../types';

const data: LinkHealthData = {
	version: 1,
	checkedAt: '2026-01-02T00:00:00.000Z',
	entries: {
		a: { status: 'ok', checkedAt: '2026-01-02T00:00:00.000Z' },
		b: {
			status: 'broken',
			code: 404,
			message: 'HTTP 404',
			checkedAt: '2026-01-02T00:00:00.000Z'
		}
	}
};

let dir: string;
let storage: JsonFileStorage;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), 'meu-hub-link-health-'));
	storage = new JsonFileStorage(dir);
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe('link-status no storage', () => {
	it('devolve vazio quando o arquivo não existe', async () => {
		expect(await storage.loadLinkHealth()).toEqual({ version: 1, checkedAt: '', entries: {} });
	});

	it('grava e lê o status dos links', async () => {
		await storage.saveLinkHealth(data);
		expect(await storage.loadLinkHealth()).toEqual(data);
	});

	it('rejeita arquivo inválido', async () => {
		await writeFile(join(dir, 'link-status.json'), '{ quebrado', 'utf-8');
		await expect(storage.loadLinkHealth()).rejects.toThrow();
	});
});
