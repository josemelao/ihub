/**
 * Acesso tolerante ao `localStorage`: modos privados, storage bloqueado por
 * política ou cota cheia não podem derrubar a página.
 */
function storage(): Storage | null {
	try {
		return globalThis.localStorage ?? null;
	} catch {
		return null;
	}
}

export function readLocal(key: string): string | null {
	try {
		return storage()?.getItem(key) ?? null;
	} catch {
		return null;
	}
}

/** `false` quando o valor não pôde ser gravado (storage indisponível ou cheio). */
export function writeLocal(key: string, value: string): boolean {
	try {
		const target = storage();
		if (!target) return false;
		target.setItem(key, value);
		return true;
	} catch {
		return false;
	}
}

export function removeLocal(key: string): void {
	try {
		storage()?.removeItem(key);
	} catch {
		// storage indisponível: nada a limpar
	}
}
