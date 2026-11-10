import type { SavedFilter } from '../types';

export interface TriageEntry {
	read: boolean;
	item: { id: string; publishedAt: string };
	source: { id: string; categoryId: string };
}

export interface UnreadCounts {
	total: number;
	byCategory: Record<string, number>;
	bySource: Record<string, number>;
}

export interface FeedScope {
	categoryId: string;
	sourceId: string;
	unreadOnly: boolean;
}

export function countUnread(entries: TriageEntry[]): UnreadCounts {
	const byCategory: Record<string, number> = {};
	const bySource: Record<string, number> = {};
	let total = 0;

	for (const entry of entries) {
		if (entry.read) continue;
		total += 1;
		const { categoryId, id: sourceId } = entry.source;
		if (categoryId) byCategory[categoryId] = (byCategory[categoryId] ?? 0) + 1;
		if (sourceId) bySource[sourceId] = (bySource[sourceId] ?? 0) + 1;
	}

	return { total, byCategory, bySource };
}

export function cutoffDaysAgo(days: number, now = new Date()): string {
	return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function idsOlderThan(entries: TriageEntry[], cutoffIso: string): string[] {
	const cutoff = Date.parse(cutoffIso);
	if (Number.isNaN(cutoff)) return [];

	const ids: string[] = [];
	for (const entry of entries) {
		if (entry.read) continue;
		const published = Date.parse(entry.item.publishedAt);
		if (Number.isNaN(published)) continue;
		if (published < cutoff) ids.push(entry.item.id);
	}
	return ids;
}

export function resolveScope(filter: SavedFilter | null, toolbar: FeedScope): FeedScope {
	if (!filter) return toolbar;
	return {
		categoryId: filter.categoryId ?? toolbar.categoryId,
		sourceId: filter.sourceId ?? toolbar.sourceId,
		unreadOnly: filter.unreadOnly ?? toolbar.unreadOnly
	};
}
