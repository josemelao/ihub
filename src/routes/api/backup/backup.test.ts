import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EMPTY_HUB } from '#lib/defaults';
import { JsonFileStorage } from '#lib/storage/json-file';
import type { HubData } from '#lib/types';
import type { RequestHandler as BackupHandler } from './$types';
import type { RequestHandler as RestoreHandler } from './restore/$types';
import type { RequestHandler as DownloadHandler } from './download/[id]/$types';

let dir: string;
let storage: JsonFileStorage;
let BACKUP_POST: BackupHandler;
let RESTORE_POST: RestoreHandler;
let DOWNLOAD_GET: DownloadHandler;

function hub(name: string): HubData {
	const data = structuredClone(EMPTY_HUB);
	data.categories.push({ id: 'jogos', name, color: '#8AA4FF', order: 1 });
	return data;
}

function postEvent(body: unknown): Parameters<RestoreHandler>[0] {
	return {
		request: new Request('http://127.0.0.1/api/backup/restore', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	} as Parameters<RestoreHandler>[0];
}

function downloadEvent(id: string): Parameters<DownloadHandler>[0] {
	return { params: { id } } as Parameters<DownloadHandler>[0];
}

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'meu-hub-backup-'));
	process.env.HUB_DATA_DIR = dir;
	storage = new JsonFileStorage(dir);
	({ POST: BACKUP_POST } = await import('./+server'));
	({ POST: RESTORE_POST } = await import('./restore/+server'));
	({ GET: DOWNLOAD_GET } = await import('./download/[id]/+server'));
});

afterAll(async () => {
	delete process.env.HUB_DATA_DIR;
	await rm(dir, { recursive: true, force: true });
});

describe('API de pontos de restauração', () => {
	it('cria ponto, lista e baixa um bundle importável', async () => {
		await storage.saveHub(hub('Ponto API'));
		await storage.saveState({
			version: 1,
			read: { a: '2026-11-09T12:00:00Z' },
			saved: [],
			savedItems: {}
		});

		const created = await BACKUP_POST({
			request: new Request('http://127.0.0.1/api/backup', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: '{}'
			})
		} as Parameters<BackupHandler>[0]);
		const createdBody = (await created.json()) as {
			ok: boolean;
			backup: { entry: { id: string; path: string } };
		};

		expect(created.status).toBe(200);
		expect(createdBody.backup.entry.path).toContain('backups');

		const download = await DOWNLOAD_GET(downloadEvent(createdBody.backup.entry.id));
		expect(download.status).toBe(200);
		expect(download.headers.get('content-disposition')).toContain('attachment');
		const bundle = (await download.json()) as {
			hub: HubData;
			state: { read: Record<string, string> };
		};
		expect(bundle.hub.categories[0].name).toBe('Ponto API');
		expect(bundle.state.read.a).toBeDefined();
	});

	it('restaura o ponto e devolve o ponto de segurança', async () => {
		await storage.saveHub(hub('Antes'));
		const created = await storage.backupNow();
		await storage.saveHub(hub('Depois'));

		const response = await RESTORE_POST(postEvent({ id: created.entry.id }));
		const body = (await response.json()) as {
			ok: boolean;
			restored: { id: string };
			safety: { id: string };
		};

		expect(response.status).toBe(200);
		expect(body.restored.id).toBe(created.entry.id);
		expect(body.safety.id).not.toBe(created.entry.id);
		expect((await storage.loadHub()).categories[0].name).toBe('Antes');
	});

	it('rejeita id inválido sem alterar dados', async () => {
		await storage.saveHub(hub('Intacto'));

		const response = await RESTORE_POST(postEvent({ id: '../hub.json' }));

		expect(response.status).toBe(400);
		expect((await storage.loadHub()).categories[0].name).toBe('Intacto');
	});

	it('rejeita download de id inválido', async () => {
		const response = await DOWNLOAD_GET(downloadEvent('../hub.json'));
		expect(response.status).toBe(400);
	});
});
