import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EMPTY_HUB } from '#lib/defaults';
import { JsonFileStorage } from '#lib/storage/json-file';
import type { RequestHandler } from './$types';

let dir: string;
let POST: RequestHandler;

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
	dir = await mkdtemp(join(tmpdir(), 'meu-hub-api-'));
	process.env.HUB_DATA_DIR = dir;
	await new JsonFileStorage(dir).saveHub(structuredClone(EMPTY_HUB));
	({ POST } = await import('./+server'));
});

afterAll(async () => {
	delete process.env.HUB_DATA_DIR;
	await rm(dir, { recursive: true, force: true });
});

describe('POST /api/hub concorrente', () => {
	it('não perde 10 filtros salvos simultâneos', async () => {
		const responses = await Promise.all(
			Array.from({ length: 10 }, (_, index) =>
				POST(
					event({
						action: 'add-filter',
						filter: {
							label: `Filtro ${index}`,
							include: [`termo-${index}`],
							exclude: [],
							matchMode: 'any'
						}
					})
				)
			)
		);

		expect(responses.every((response) => response.status === 200)).toBe(true);

		const hub = await new JsonFileStorage(dir).loadHub();
		expect(hub.savedFilters).toHaveLength(10);
		expect(hub.savedFilters.map((filter) => filter.label).sort()).toEqual(
			Array.from({ length: 10 }, (_, index) => `Filtro ${index}`).sort()
		);
	});
});
