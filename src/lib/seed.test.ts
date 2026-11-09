import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseHub } from './schema';

describe('data/hub.example.json semeado', () => {
	it('é válido segundo o schema', async () => {
		const raw = await readFile(join(process.cwd(), 'data', 'hub.example.json'), 'utf-8');
		const hub = parseHub(JSON.parse(raw));

		expect(hub.categories.length).toBeGreaterThan(0);
		expect(hub.items.length).toBeGreaterThan(0);
		expect(hub.savedFilters.map((f) => f.label)).toContain('patch');
	});
});
