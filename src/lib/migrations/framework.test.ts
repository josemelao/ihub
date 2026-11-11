import { describe, expect, it } from 'vitest';
import { migrateFeedCache, migrateState } from './state';
import { HubValidationError } from '../schema';

describe('migrações de estado e cache', () => {
	it('mantém a versão atual sem notas', () => {
		const result = migrateState({ version: 1, read: {}, saved: [], savedItems: {} });

		expect(result).toMatchObject({ from: 1, to: 1, notes: [] });
	});

	it('preenche version ausente', () => {
		expect(migrateFeedCache({ items: [], sources: {} }).data.version).toBe(1);
	});

	it('recusa versão futura de estado', () => {
		expect(() => migrateState({ version: 9 })).toThrow(HubValidationError);
	});

	it('recusa versão futura de cache', () => {
		expect(() => migrateFeedCache({ version: 9 })).toThrow(HubValidationError);
	});
});
