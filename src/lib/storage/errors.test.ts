import { describe, expect, it } from 'vitest';
import { isNotFound, isRecoverableDataError, StorageError } from './errors';

describe('StorageError', () => {
	it('carrega código, caminho e mensagem', () => {
		const error = new StorageError('NOT_FOUND', 'data/hub.json', 'Arquivo não encontrado');

		expect(error.code).toBe('NOT_FOUND');
		expect(error.path).toBe('data/hub.json');
		expect(error.message).toMatch(/não encontrado/i);
		expect(error.name).toBe('StorageError');
	});

	it('preserva a causa', () => {
		const cause = new Error('EACCES');
		expect(new StorageError('IO', 'x', 'falhou', cause).cause).toBe(cause);
	});

	it('reconhece não encontrado e erros recuperáveis', () => {
		const missing = new StorageError('NOT_FOUND', 'x', 'faltou');
		const invalid = new StorageError('INVALID_JSON', 'x', 'quebrado');
		const io = new StorageError('IO', 'x', 'disco');

		expect(isNotFound(missing)).toBe(true);
		expect(isNotFound(invalid)).toBe(false);
		expect(isRecoverableDataError(missing)).toBe(true);
		expect(isRecoverableDataError(invalid)).toBe(true);
		expect(isRecoverableDataError(io)).toBe(false);
		expect(isRecoverableDataError(new Error('x'))).toBe(false);
	});
});
