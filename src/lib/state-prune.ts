import type { HubState, SavedItemSnapshot } from './types';

export const DEFAULT_READ_RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface PruneOptions {
	now?: Date;
	retentionDays?: number;
}

export interface PruneResult {
	state: HubState;
	removedRead: number;
	removedSnapshots: number;
	changed: boolean;
}

/**
 * Remove leituras antigas (exceto de posts salvos) e snapshots órfãos.
 * Idempotente: rodar de novo sem mudanças não altera o estado.
 */
export function pruneState(state: HubState, options: PruneOptions = {}): PruneResult {
	const now = options.now ?? new Date();
	const retentionDays = options.retentionDays ?? DEFAULT_READ_RETENTION_DAYS;
	const cutoff = now.getTime() - retentionDays * DAY_MS;
	const saved = new Set(state.saved);

	const read: Record<string, string> = {};
	let removedRead = 0;

	for (const [id, stamp] of Object.entries(state.read)) {
		if (saved.has(id)) {
			read[id] = stamp;
			continue;
		}

		const time = Date.parse(stamp);
		if (!Number.isNaN(time) && time >= cutoff) {
			read[id] = stamp;
		} else {
			removedRead += 1;
		}
	}

	const savedItems: Record<string, SavedItemSnapshot> = {};
	let removedSnapshots = 0;

	for (const [id, snapshot] of Object.entries(state.savedItems)) {
		if (saved.has(id)) {
			savedItems[id] = snapshot;
		} else {
			removedSnapshots += 1;
		}
	}

	const changed = removedRead > 0 || removedSnapshots > 0;

	return {
		state: {
			version: state.version,
			read,
			saved: [...state.saved],
			savedItems,
			...(changed
				? { lastPrunedAt: now.toISOString() }
				: state.lastPrunedAt
					? { lastPrunedAt: state.lastPrunedAt }
					: {})
		},
		removedRead,
		removedSnapshots,
		changed
	};
}
