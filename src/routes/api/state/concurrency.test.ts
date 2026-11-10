import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RequestHandler } from './$types';

let dir: string;
let POST: RequestHandler;

function event(body: unknown): Parameters<RequestHandler>[0] {
	return {
		request: new Request('http://127.0.0.1/api/state', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	} as Parameters<RequestHandler>[0];
}

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'meu-hub-state-'));
	process.env.HUB_DATA_DIR = dir;
	({ POST } = await import('./+server'));
});

afterAll(async () => {
	delete process.env.HUB_DATA_DIR;
	await rm(dir, { recursive: true, force: true });
});

describe('POST /api/state concorrente', () => {
	it('não perde 10 marcações simultâneas de leitura', async () => {
		const responses = await Promise.all(
			Array.from({ length: 10 }, (_, index) => POST(event({ action: 'read', id: `post-${index}` })))
		);

		expect(responses.every((response) => response.status === 200)).toBe(true);

		const { getStorage } = await import('#lib/storage');
		const state = await getStorage().loadState();
		expect(Object.keys(state.read).sort()).toEqual(
			Array.from({ length: 10 }, (_, index) => `post-${index}`).sort()
		);
	});
});
