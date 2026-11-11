import { HubValidationError } from '../schema';
import type { MigrationResult } from './types';

export function versionOf(raw: Record<string, unknown>): number {
	return typeof raw.version === 'number' && Number.isFinite(raw.version) ? raw.version : 1;
}

export function assertSupportedVersion(version: number, current: number, label: string): void {
	if (version <= current) return;
	throw new HubValidationError(
		[
			{
				path: ['version'],
				message: `${label} versão ${version} não é suportada por esta versão do app (máx. ${current}).`
			}
		],
		label
	);
}

/**
 * Migração de arquivos cujo schema ainda não mudou: garante a versão atual e
 * recusa versão futura. Cada passo novo entra aqui em vez de espalhar I/O.
 */
export function migratePassthrough(
	input: unknown,
	options: { label: string; current: number }
): MigrationResult<Record<string, unknown>> {
	if (!input || typeof input !== 'object' || Array.isArray(input)) {
		return { data: input as Record<string, unknown>, from: 0, to: 0, notes: [] };
	}

	const raw = input as Record<string, unknown>;
	const from = versionOf(raw);
	assertSupportedVersion(from, options.current, options.label);

	const hasVersion = typeof raw.version === 'number';
	const data = raw.version === options.current ? raw : { ...raw, version: options.current };

	return {
		data,
		from,
		to: options.current,
		notes:
			hasVersion && from !== options.current
				? [`${options.label}: versão ${from} → ${options.current}.`]
				: []
	};
}
