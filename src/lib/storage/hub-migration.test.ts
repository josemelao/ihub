import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonFileStorage } from './json-file';
import { HubValidationError } from '../schema';
import v1 from '../migrations/fixtures/hub-v1.json';

let dir: string;
let storage: JsonFileStorage;

const raw = () => JSON.parse(JSON.stringify(v1)) as Record<string, unknown>;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), 'meu-hub-migration-'));
	storage = new JsonFileStorage(dir);
	await writeFile(join(dir, 'hub.json'), JSON.stringify(raw()), 'utf8');
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe('migração no carregamento do hub', () => {
	it('migra v1 para v2 e grava o resultado', async () => {
		const hub = await storage.loadHub();
		const saved = JSON.parse(await readFile(join(dir, 'hub.json'), 'utf8'));

		expect(hub.version).toBe(2);
		expect(saved.version).toBe(2);
		expect(hub.feedSources).toHaveLength(3);
		expect(saved.feedSources.map((source: { order: number }) => source.order)).toEqual([2, 1, 1]);
	});

	it('guarda uma cópia pré-migração', async () => {
		await storage.loadHub();

		const pre = JSON.parse(await readFile(join(dir, 'hub.json.pre-v1.bak'), 'utf8'));
		expect(pre.version).toBe(1);
	});

	it('não migra de novo no segundo carregamento', async () => {
		await storage.loadHub();
		await rm(join(dir, 'hub.json.pre-v1.bak'));

		await storage.loadHub();

		expect(existsSync(join(dir, 'hub.json.pre-v1.bak'))).toBe(false);
	});

	it('não altera o arquivo quando o conteúdo é inválido', async () => {
		const invalid = raw();
		invalid.categories = 'nada';
		const original = JSON.stringify(invalid);
		await writeFile(join(dir, 'hub.json'), original, 'utf8');

		await expect(storage.loadHub()).rejects.toThrow(HubValidationError);
		expect(await readFile(join(dir, 'hub.json'), 'utf8')).toBe(original);
	});

	it('recusa versão futura sem tocar no arquivo', async () => {
		const future = raw();
		future.version = 99;
		const original = JSON.stringify(future);
		await writeFile(join(dir, 'hub.json'), original, 'utf8');

		await expect(storage.loadHub()).rejects.toThrow(HubValidationError);
		try {
			await storage.loadHub();
		} catch (error) {
			expect((error as HubValidationError).issues[0]?.message).toMatch(/não é suportada/i);
		}
		expect(await readFile(join(dir, 'hub.json'), 'utf8')).toBe(original);
	});

	it('migra também o backup usado no fallback', async () => {
		await writeFile(join(dir, 'hub.json'), '{ corrompido', 'utf8');
		await writeFile(join(dir, 'hub.json.bak'), JSON.stringify(raw()), 'utf8');

		const result = await storage.loadHubWithFallback();

		expect(result.error?.usingBackup).toBe(true);
		expect(result.hub.version).toBe(2);
		expect(result.hub.feedSources[0].order).toBe(2);
	});
});
