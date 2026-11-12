export type StorageErrorCode = 'NOT_FOUND' | 'INVALID_JSON' | 'VALIDATION' | 'LOCK_TIMEOUT' | 'IO';

/**
 * Erro de armazenamento com código estável. `path` é o arquivo/diretório
 * envolvido e `cause` preserva o erro original (sem expor segredo).
 */
export class StorageError extends Error {
	readonly code: StorageErrorCode;
	readonly path: string;

	constructor(code: StorageErrorCode, path: string, message: string, cause?: unknown) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = 'StorageError';
		this.code = code;
		this.path = path;
	}
}

export function isNotFound(error: unknown): error is StorageError {
	return error instanceof StorageError && error.code === 'NOT_FOUND';
}

/** Erros de dado recuperáveis (arquivo ausente/corrompido) para fallback. */
export function isRecoverableDataError(error: unknown): error is StorageError {
	return (
		error instanceof StorageError && (error.code === 'NOT_FOUND' || error.code === 'INVALID_JSON')
	);
}
