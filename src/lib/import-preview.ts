import type { HubData, HubState } from './types';

export type ImportMode = 'replace' | 'merge';

export interface CollectionDiff {
	added: string[];
	updated: string[];
	removed: string[];
}

export type ImportCollection = 'categories' | 'groups' | 'items' | 'feedSources' | 'savedFilters';

export interface ImportPreview {
	mode: ImportMode;
	counts: Record<ImportCollection, number>;
	changes: Record<ImportCollection, CollectionDiff>;
	settingsConflict: boolean;
	currentSettings: HubData['settings'];
	incomingSettings: HubData['settings'];
	state: { read: number; saved: number; snapshots: number } | null;
}

const COLLECTIONS: ImportCollection[] = [
	'categories',
	'groups',
	'items',
	'feedSources',
	'savedFilters'
];

function diffCollection<T extends { id: string }>(
	current: T[],
	incoming: T[],
	mode: ImportMode
): CollectionDiff {
	const currentById = new Map(current.map((entry) => [entry.id, entry]));
	const incomingIds = new Set(incoming.map((entry) => entry.id));
	const added: string[] = [];
	const updated: string[] = [];

	for (const entry of incoming) {
		const previous = currentById.get(entry.id);
		if (!previous) {
			added.push(entry.id);
		} else if (JSON.stringify(previous) !== JSON.stringify(entry)) {
			updated.push(entry.id);
		}
	}

	const removed =
		mode === 'replace'
			? current.filter((entry) => !incomingIds.has(entry.id)).map((entry) => entry.id)
			: [];

	return { added, updated, removed };
}

export function buildImportPreview(
	current: HubData,
	incoming: HubData,
	mode: ImportMode,
	incomingState?: HubState
): ImportPreview {
	const changes = {} as Record<ImportCollection, CollectionDiff>;
	const counts = {} as Record<ImportCollection, number>;

	for (const collection of COLLECTIONS) {
		changes[collection] = diffCollection(
			current[collection] as { id: string }[],
			incoming[collection] as { id: string }[],
			mode
		);
		counts[collection] = incoming[collection].length;
	}

	return {
		mode,
		counts,
		changes,
		settingsConflict: JSON.stringify(current.settings) !== JSON.stringify(incoming.settings),
		currentSettings: current.settings,
		incomingSettings: incoming.settings,
		state: incomingState
			? {
					read: Object.keys(incomingState.read).length,
					saved: incomingState.saved.length,
					snapshots: Object.keys(incomingState.savedItems).length
				}
			: null
	};
}
