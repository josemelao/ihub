import { describe, expect, it } from 'vitest';
import { HubValidationError, parseArchiveIndex } from '../schema';

const entry = {
	id: 'abc',
	status: 'ready' as const,
	title: 'T',
	url: 'https://e.com/a',
	bytes: 10,
	assets: 1,
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z'
};

describe('schema do arquivo', () => {
	it('aceita índice válido e rejeita status desconhecido', () => {
		expect(parseArchiveIndex({ version: 1, entries: { abc: entry } }).entries.abc.status).toBe(
			'ready'
		);
		expect(() =>
			parseArchiveIndex({ version: 1, entries: { abc: { ...entry, status: 'x' } } })
		).toThrow(HubValidationError);
	});

	it('rejeita id inseguro e url não http(s)', () => {
		expect(() => parseArchiveIndex({ version: 1, entries: { '../x': entry } })).toThrow(
			HubValidationError
		);
		expect(() =>
			parseArchiveIndex({ version: 1, entries: { abc: { ...entry, url: 'javascript:x' } } })
		).toThrow(HubValidationError);
	});
});
