import type { ArchiveEntry } from '../types';

export interface ArchiveSummary {
	count: number;
	bytes: number;
	pending: number;
	failed: number;
}

export function summarizeArchive(entries: ArchiveEntry[]): ArchiveSummary {
	return entries.reduce<ArchiveSummary>(
		(summary, entry) => ({
			count: summary.count + 1,
			bytes: summary.bytes + (entry.status === 'ready' ? entry.bytes : 0),
			pending: summary.pending + (entry.status === 'pending' ? 1 : 0),
			failed: summary.failed + (entry.status === 'failed' ? 1 : 0)
		}),
		{ count: 0, bytes: 0, pending: 0, failed: 0 }
	);
}
