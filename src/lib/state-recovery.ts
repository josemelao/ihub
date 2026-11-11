import { parseHubState } from './schema';
import { HubValidationError } from './schema';
import type { HubState, SavedItemSnapshot, StateRecoveryInfo, ValidationIssue } from './types';
import { stateSchema } from './schema';

export interface RecoveredState {
	state: HubState;
	recovery: StateRecoveryInfo;
}

function structuralError(message: string): HubValidationError {
	const issues: ValidationIssue[] = [{ path: [], message }];
	return new HubValidationError(issues, 'estado.json');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Valida um snapshot individual reutilizando o schema de estado completo. */
function snapshotOf(value: unknown, key: string): SavedItemSnapshot | null {
	const probe = stateSchema.safeParse({
		version: 1,
		read: {},
		saved: [key],
		savedItems: { [key]: value }
	});
	if (!probe.success) return null;
	return (probe.data as HubState).savedItems[key] ?? null;
}

/**
 * Recupera o máximo de `estado.json` em vez de descartar tudo quando um
 * snapshot isolado está corrompido. Erros estruturais (topo não é objeto,
 * `read`/`saved`/`savedItems` com tipo errado) continuam sendo erro: aí o
 * chamador cai para backup/estado vazio.
 */
export function recoverHubState(input: unknown): RecoveredState {
	if (!isRecord(input)) {
		throw structuralError('O estado precisa ser um objeto.');
	}
	if ('read' in input && input.read !== undefined && !isRecord(input.read)) {
		throw structuralError('"read" precisa ser um objeto.');
	}
	if ('saved' in input && input.saved !== undefined && !Array.isArray(input.saved)) {
		throw structuralError('"saved" precisa ser uma lista.');
	}
	if ('savedItems' in input && input.savedItems !== undefined && !isRecord(input.savedItems)) {
		throw structuralError('"savedItems" precisa ser um objeto.');
	}

	let removedRead = 0;
	const read: Record<string, string> = {};
	for (const [key, value] of Object.entries((input.read ?? {}) as Record<string, unknown>)) {
		if (typeof value === 'string') read[key] = value;
		else removedRead += 1;
	}

	let removedSaved = 0;
	const saved: string[] = [];
	for (const value of (input.saved ?? []) as unknown[]) {
		if (typeof value === 'string' && value && !saved.includes(value)) saved.push(value);
		else removedSaved += 1;
	}

	let removedSnapshots = 0;
	const savedItems: Record<string, SavedItemSnapshot> = {};
	for (const [key, value] of Object.entries((input.savedItems ?? {}) as Record<string, unknown>)) {
		const snapshot = snapshotOf(value, key);
		if (snapshot) savedItems[key] = snapshot;
		else removedSnapshots += 1;
	}

	const state = parseHubState({
		version: input.version ?? 1,
		read,
		saved,
		savedItems,
		...(typeof input.lastPrunedAt === 'string' ? { lastPrunedAt: input.lastPrunedAt } : {})
	});

	return { state, recovery: { removedSnapshots, removedRead, removedSaved } };
}
