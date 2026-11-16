import type { UsageData, UsageEntry } from './types';

export const MAX_USAGE_ENTRIES = 500;

function sortedRecent(entries: UsageEntry[]): UsageEntry[] {
	return entries.sort(
		(left, right) =>
			right.lastOpenedAt.localeCompare(left.lastOpenedAt) || left.id.localeCompare(right.id)
	);
}

/** Registra uma abertura, incrementando a contagem e limitando o histórico. */
export function recordUsage(data: UsageData, id: string, lastOpenedAt: string): UsageData {
	const current = data.entries[id];
	const entries: Record<string, UsageEntry> = {
		...data.entries,
		[id]: { id, count: (current?.count ?? 0) + 1, lastOpenedAt }
	};

	const values = Object.values(entries);
	if (values.length <= MAX_USAGE_ENTRIES) return { ...data, entries };

	const kept = sortedRecent(values).slice(0, MAX_USAGE_ENTRIES);
	return {
		...data,
		entries: Object.fromEntries(kept.map((entry) => [entry.id, entry]))
	};
}

export function recentUsage(data: UsageData, limit = 5): UsageEntry[] {
	return sortedRecent(Object.values(data.entries)).slice(0, limit);
}

export function mostUsedUsage(data: UsageData, limit = 8): UsageEntry[] {
	return Object.values(data.entries)
		.sort(
			(left, right) =>
				right.count - left.count ||
				right.lastOpenedAt.localeCompare(left.lastOpenedAt) ||
				left.id.localeCompare(right.id)
		)
		.slice(0, limit);
}
