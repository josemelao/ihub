export interface AtomicFileDeps {
	writeFile(path: string, data: string): Promise<void>;
	readFile(path: string): Promise<string>;
	copyFile(from: string, to: string): Promise<void>;
	rename(from: string, to: string): Promise<void>;
	unlink(path: string): Promise<void>;
	sleep(ms: number): Promise<void>;
	uniqueSuffix(): string;
}

export interface AtomicWriteOptions {
	/** Cópia de segurança do conteúdo atual antes de sobrescrever. */
	backupPath?: string;
	/** Só cria backup se o conteúdo atual for aceitável (ex.: JSON válido). */
	keepBackup?: (raw: string) => boolean;
	/** Total de gerações mantidas, incluindo o `.bak` mais novo. */
	backupGenerations?: number;
}

const RETRYABLE_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);
const RETRY_DELAYS_MS = [50, 100, 200, 400, 800];

function codeOf(error: unknown): string | undefined {
	return (error as NodeJS.ErrnoException | undefined)?.code;
}

function atomicWriteError(finalPath: string, error: unknown): Error {
	const code = codeOf(error);
	const suffix = code ? ` (${code})` : '';
	return new Error(
		`Não foi possível gravar ${finalPath}${suffix}: ${(error as Error | undefined)?.message ?? String(error)}`,
		{ cause: error }
	);
}

async function rotateBackups(
	backupPath: string,
	deps: AtomicFileDeps,
	generations: number
): Promise<boolean> {
	if (generations <= 1) return true;

	// Desloca da geração mais antiga para a mais nova, sobrescrevendo a última.
	for (let index = generations - 2; index >= 1; index -= 1) {
		try {
			await deps.copyFile(`${backupPath}.${index}`, `${backupPath}.${index + 1}`);
		} catch (error) {
			if (codeOf(error) !== 'ENOENT') return false;
		}
	}

	try {
		await deps.copyFile(backupPath, `${backupPath}.1`);
	} catch (error) {
		if (codeOf(error) !== 'ENOENT') return false;
	}

	return true;
}

async function renameWithRetry(
	tempPath: string,
	finalPath: string,
	deps: AtomicFileDeps
): Promise<void> {
	let lastError: unknown;

	for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
		try {
			await deps.rename(tempPath, finalPath);
			return;
		} catch (error) {
			lastError = error;
			const code = codeOf(error);
			if (!code || !RETRYABLE_CODES.has(code)) break;
			if (attempt < RETRY_DELAYS_MS.length) {
				await deps.sleep(RETRY_DELAYS_MS[attempt]);
			}
		}
	}

	// Último recurso: copiar por cima e remover o temporário. Cobre o caso em que
	// OneDrive/antivírus mantém o destino aberto e o rename nunca é liberado.
	if (RETRYABLE_CODES.has(codeOf(lastError) ?? '')) {
		try {
			await deps.copyFile(tempPath, finalPath);
			await deps.unlink(tempPath).catch(() => undefined);
			return;
		} catch {
			// Mantém o erro original do rename, que explica melhor a causa.
		}
	}

	throw atomicWriteError(finalPath, lastError);
}

export async function writeFileAtomically(
	finalPath: string,
	contents: string,
	deps: AtomicFileDeps,
	options: AtomicWriteOptions = {}
): Promise<void> {
	// O rename é atômico; o fallback copyFile do Windows sobrescreve in-place e
	// não protege contra queda de energia no meio da cópia — o .bak cobre isso.
	const tempPath = `${finalPath}.tmp-${deps.uniqueSuffix()}`;

	try {
		await deps.writeFile(tempPath, contents);

		if (options.backupPath) {
			let current: string | null = null;
			try {
				current = await deps.readFile(finalPath);
			} catch (error) {
				if (codeOf(error) !== 'ENOENT') throw error;
			}

			if (current !== null && (!options.keepBackup || options.keepBackup(current))) {
				// Backup é best-effort: um .bak bloqueado pelo OneDrive não pode
				// impedir a gravação do arquivo principal.
				const rotated = await rotateBackups(
					options.backupPath,
					deps,
					options.backupGenerations ?? 1
				);
				if (rotated) {
					await deps.copyFile(finalPath, options.backupPath).catch(() => undefined);
				}
			}
		}

		await renameWithRetry(tempPath, finalPath, deps);
	} finally {
		await deps.unlink(tempPath).catch(() => undefined);
	}
}
