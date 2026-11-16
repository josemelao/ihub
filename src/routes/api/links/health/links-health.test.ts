import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GET, POST } from './+server';

let dir: string;
let previous: string | undefined;

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'meu-hub-link-health-route-'));
	previous = process.env.HUB_DATA_DIR;
	process.env.HUB_DATA_DIR = dir;

	const hub = {
		version: 1,
		settings: { accent: '#8AA4FF' },
		categories: [],
		groups: [],
		items: [],
		feedSources: [],
		savedFilters: []
	};
	await writeFile(join(dir, 'hub.json'), `${JSON.stringify(hub, null, 2)}\n`, 'utf-8');
});

afterAll(async () => {
	if (previous === undefined) delete process.env.HUB_DATA_DIR;
	else process.env.HUB_DATA_DIR = previous;
	await rm(dir, { recursive: true, force: true });
});

async function callGet(): Promise<Response> {
	return GET({} as never);
}

async function callPost(): Promise<Response> {
	return POST({} as never);
}

describe('GET/POST /api/links/health', () => {
	it('devolve vazio antes da primeira verificação', async () => {
		const response = await callGet();
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ version: 1, checkedAt: '', entries: {} });
	});

	it('verifica e grava os status dos links', async () => {
		const response = await callPost();
		const body = (await response.json()) as {
			ok: boolean;
			checkedAt: string;
			entries: Record<string, unknown>;
		};

		expect(response.status).toBe(200);
		expect(body.ok).toBe(true);
		expect(body.entries).toEqual({});
		expect(body.checkedAt).not.toBe('');

		const stored = (await (await callGet()).json()) as { checkedAt: string };
		expect(stored.checkedAt).toBe(body.checkedAt);
	});
});
