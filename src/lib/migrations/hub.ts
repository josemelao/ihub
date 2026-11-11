import { normalizeSourceOrders } from '../feed/order';
import { HubValidationError } from '../schema';
import type { FeedSource } from '../types';
import type { MigrationResult } from './types';

/** Versão do `hub.json` que este app grava/entende. */
export const HUB_SCHEMA_VERSION = 2;

function versionOf(raw: Record<string, unknown>): number {
	return typeof raw.version === 'number' && Number.isFinite(raw.version) ? raw.version : 1;
}

/**
 * Normaliza `order` das fontes no dado cru. Entradas inválidas são deixadas
 * como estão para o schema reportar o problema com o caminho certo.
 */
function normalizeRawSources(value: unknown): unknown {
	if (!Array.isArray(value)) return value;
	if (value.some((entry) => !entry || typeof entry !== 'object')) return value;
	if (!value.every((entry) => typeof (entry as { categoryId?: unknown }).categoryId === 'string')) {
		return value;
	}
	return normalizeSourceOrders(value as FeedSource[]);
}

/**
 * Migra o hub até a versão atual. Puro: não faz I/O e não valida o schema —
 * quem chama valida antes de gravar.
 *
 * v1 → v2: `order` das fontes passa a ser 1..n por categoria (antes misturava
 * índice global com ordem manual).
 */
export function migrateHub(input: unknown): MigrationResult<Record<string, unknown>> {
	if (!input || typeof input !== 'object' || Array.isArray(input)) {
		return { data: input as Record<string, unknown>, from: 0, to: 0, notes: [] };
	}

	const raw = input as Record<string, unknown>;
	const from = versionOf(raw);

	if (from > HUB_SCHEMA_VERSION) {
		throw new HubValidationError(
			[
				{
					path: ['version'],
					message: `hub.json versão ${from} não é suportada por esta versão do app (máx. ${HUB_SCHEMA_VERSION}).`
				}
			],
			'hub.json'
		);
	}

	if (from === HUB_SCHEMA_VERSION) {
		return { data: raw, from, to: from, notes: [] };
	}

	const data: Record<string, unknown> = { ...raw, version: HUB_SCHEMA_VERSION };
	const notes: string[] = [];

	if (from < 2) {
		data.feedSources = normalizeRawSources(raw.feedSources);
		notes.push('v1→v2: order das fontes normalizada por categoria.');
	}

	return { data, from, to: HUB_SCHEMA_VERSION, notes };
}
