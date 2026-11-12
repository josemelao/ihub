import type { MigrationResult } from './types';
import { migratePassthrough } from './run';

export const STATE_SCHEMA_VERSION = 1;
export const CACHE_SCHEMA_VERSION = 1;
export const NOTES_SCHEMA_VERSION = 1;
export const HIGHLIGHTS_SCHEMA_VERSION = 1;

export function migrateState(input: unknown): MigrationResult<Record<string, unknown>> {
	return migratePassthrough(input, { label: 'estado.json', current: STATE_SCHEMA_VERSION });
}

export function migrateFeedCache(input: unknown): MigrationResult<Record<string, unknown>> {
	return migratePassthrough(input, {
		label: 'feed-cache.json',
		current: CACHE_SCHEMA_VERSION
	});
}

export function migrateNotes(input: unknown): MigrationResult<Record<string, unknown>> {
	return migratePassthrough(input, { label: 'notes.json', current: NOTES_SCHEMA_VERSION });
}

export function migrateHighlights(input: unknown): MigrationResult<Record<string, unknown>> {
	return migratePassthrough(input, {
		label: 'highlights.json',
		current: HIGHLIGHTS_SCHEMA_VERSION
	});
}
