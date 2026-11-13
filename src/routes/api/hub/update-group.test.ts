import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EMPTY_HUB } from '#lib/defaults';
import { JsonFileStorage } from '#lib/storage/json-file';
import type { HubData } from '#lib/types';
import type { RequestHandler } from './$types';

let dir: string;
let storage: JsonFileStorage;
let POST: RequestHandler;

function hubWithGroup(): HubData {
	const hub = structuredClone(EMPTY_HUB);
	hub.categories.push({ id: 'jogos', name: 'Jogos', color: '#8AA4FF', order: 1 });
	hub.groups.push({ id: 'darktide', categoryId: 'jogos', name: 'Darktide', order: 1 });
	return hub;
}

function event(body: unknown): Parameters<RequestHandler>[0] {
	return {
		request: new Request('http://127.0.0.1/api/hub', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	} as Parameters<RequestHandler>[0];
}

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'meu-hub-group-pin-'));
	process.env.HUB_DATA_DIR = dir;
	storage = new JsonFileStorage(dir);
	({ POST } = await import('./+server'));
});

beforeEach(async () => {
	await storage.saveHub(hubWithGroup());
});

afterAll(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe('POST /api/hub — grupo no acesso rápido', () => {
	it('persiste pinned no hub gravado', async () => {
		const response = await POST(
			event({ action: 'update-group', id: 'darktide', groupPatch: { pinned: true } })
		);
		const body = (await response.json()) as { ok: boolean; hub: HubData };

		expect(response.status).toBe(200);
		expect(body.ok).toBe(true);
		expect(body.hub.groups[0].pinned).toBe(true);
		expect(body.hub.settings.quickAccessOrder).toEqual(['group:darktide']);

		const stored = await storage.loadHub();
		expect(stored.groups[0].pinned).toBe(true);
	});

	it('remove a chave da ordem ao desafixar', async () => {
		await POST(event({ action: 'update-group', id: 'darktide', groupPatch: { pinned: true } }));

		const response = await POST(
			event({ action: 'update-group', id: 'darktide', groupPatch: { pinned: false } })
		);
		const body = (await response.json()) as { ok: boolean; hub: HubData };

		expect(body.hub.groups[0].pinned).toBe(false);
		expect(body.hub.settings.quickAccessOrder).toEqual([]);
	});
});
