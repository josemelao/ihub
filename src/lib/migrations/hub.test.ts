import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HUB_SCHEMA_VERSION, migrateHub } from './hub';
import { HubValidationError } from '../schema';

const fixture = () =>
	JSON.parse(
		readFileSync(join(process.cwd(), 'src/lib/migrations/fixtures/hub-v1.json'), 'utf8')
	) as Record<string, unknown>;

describe('migrateHub v1 → v2', () => {
	it('sobe a versão e preserva todas as coleções', () => {
		const raw = fixture();
		const { data, from, to } = migrateHub(raw);

		expect(from).toBe(1);
		expect(to).toBe(2);
		expect(data.version).toBe(2);
		expect((data.categories as unknown[]).length).toBe(2);
		expect((data.groups as unknown[]).length).toBe(1);
		expect((data.items as unknown[]).length).toBe(2);
		expect((data.feedSources as unknown[]).length).toBe(3);
		expect((data.savedFilters as unknown[]).length).toBe(1);
		expect((data.items as { id: string }[]).map((item) => item.id)).toEqual(['wiki', 'planilha']);
	});

	it('normaliza order das fontes por categoria', () => {
		const { data } = migrateHub(fixture());
		const sources = data.feedSources as { id: string; order: number }[];
		const byId = Object.fromEntries(sources.map((source) => [source.id, source.order]));

		expect(byId['reddit-darktide']).toBe(1);
		expect(byId['rss-jogos']).toBe(2);
		expect(byId['rss-trabalho']).toBe(1);
	});

	it('trata ausência de version como v1', () => {
		const raw = fixture();
		delete raw.version;

		expect(migrateHub(raw)).toMatchObject({ from: 1, to: 2 });
	});

	it('é idempotente em v2', () => {
		const once = migrateHub(fixture()).data;
		const twice = migrateHub(once);

		expect(twice.from).toBe(HUB_SCHEMA_VERSION);
		expect(twice.to).toBe(HUB_SCHEMA_VERSION);
		expect(twice.data).toEqual(once);
		expect(twice.notes).toEqual([]);
	});

	it('recusa versão futura com mensagem clara', () => {
		const raw = fixture();
		raw.version = 99;

		expect(() => migrateHub(raw)).toThrow(HubValidationError);
		try {
			migrateHub(raw);
		} catch (error) {
			const issues = (error as HubValidationError).issues;
			expect(issues[0]?.message).toMatch(/versão 99/i);
		}
	});

	it('não quebra com fontes inválidas (o schema reporta depois)', () => {
		const raw = fixture();
		(raw.feedSources as unknown[]).push('quebrada');

		expect(() => migrateHub(raw)).not.toThrow();
	});
});
