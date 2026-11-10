const STORAGE_KEY = 'meu-hub:undo-mark-all';
const DEFAULT_TTL_MS = 30_000;

export interface UndoBatch {
	ids: string[];
	expiresAt: number;
}

function storage(): Storage | null {
	try {
		return typeof sessionStorage === 'undefined' ? null : sessionStorage;
	} catch {
		return null;
	}
}

export function saveUndoBatch(ids: string[], ttlMs = DEFAULT_TTL_MS, now = Date.now()): UndoBatch {
	const batch: UndoBatch = { ids: [...ids], expiresAt: now + ttlMs };
	try {
		storage()?.setItem(STORAGE_KEY, JSON.stringify(batch));
	} catch {
		// sessão indisponível: o lote vale só na memória do componente
	}
	return batch;
}

export function loadUndoBatch(now = Date.now()): UndoBatch | null {
	try {
		const raw = storage()?.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<UndoBatch>;
		if (!Array.isArray(parsed.ids) || typeof parsed.expiresAt !== 'number') {
			clearUndoBatch();
			return null;
		}
		const ids = parsed.ids.filter((id): id is string => typeof id === 'string');
		if (ids.length === 0 || parsed.expiresAt <= now) {
			clearUndoBatch();
			return null;
		}
		return { ids, expiresAt: parsed.expiresAt };
	} catch {
		return null;
	}
}

export function clearUndoBatch(): void {
	try {
		storage()?.removeItem(STORAGE_KEY);
	} catch {
		// ignora indisponibilidade do sessionStorage
	}
}
