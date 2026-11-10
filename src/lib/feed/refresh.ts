import { fetchPublicText } from '../net/safe-fetch';
import type { FeedCache, FeedItem, FeedSourceStatus, HubData } from '../types';
import { parseFeed } from './parse';
import { resolveFeedUrl } from './sources';

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export interface RefreshOptions {
	fetcher?: Fetcher;
	now?: () => Date;
	force?: boolean;
	timeoutMs?: number;
	retentionDays?: number;
	maxPerSource?: number;
	sourceId?: string;
}

export interface RefreshResult {
	sourceId: string;
	name: string;
	ok: boolean;
	count: number;
	skipped: boolean;
	error?: string;
}

export interface RefreshOutcome {
	cache: FeedCache;
	results: RefreshResult[];
}

const DEFAULT_MAX_PER_SOURCE = 30;
const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 5_000_000;

export async function refreshFeed(
	hub: HubData,
	cache: FeedCache,
	options: RefreshOptions = {}
): Promise<RefreshOutcome> {
	const fetcher = options.fetcher ?? (fetch as Fetcher);
	const now = options.now?.() ?? new Date();
	const nowIso = now.toISOString();
	const defaultMaxPerSource = options.maxPerSource ?? DEFAULT_MAX_PER_SOURCE;
	const retentionMs = (options.retentionDays ?? DEFAULT_RETENTION_DAYS) * 24 * 60 * 60 * 1000;
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

	const itemsBySource = new Map<string, FeedItem[]>();
	for (const item of cache.items) {
		const list = itemsBySource.get(item.sourceId) ?? [];
		list.push(item);
		itemsBySource.set(item.sourceId, list);
	}

	const sources: Record<string, FeedSourceStatus> = { ...cache.sources };
	const results: RefreshResult[] = [];

	for (const source of hub.feedSources) {
		if (options.sourceId && source.id !== options.sourceId) continue;

		const status = sources[source.id];

		if (!source.enabled) {
			results.push({
				sourceId: source.id,
				name: source.name,
				ok: true,
				count: status?.count ?? 0,
				skipped: true
			});
			continue;
		}

		const lastFetched = status?.lastFetchedAt ? Date.parse(status.lastFetchedAt) : Number.NaN;
		const due =
			options.force === true ||
			Number.isNaN(lastFetched) ||
			now.getTime() - lastFetched >= source.intervalMinutes * 60 * 1000;

		if (!due) {
			results.push({
				sourceId: source.id,
				name: source.name,
				ok: true,
				count: status?.count ?? 0,
				skipped: true
			});
			continue;
		}

		try {
			const url = await resolveFeedUrl(source, { fetcher, timeoutMs });
			const { text } = await fetchPublicText(url, {
				fetcher,
				timeoutMs,
				maxBytes: MAX_RESPONSE_BYTES
			});
			const parsed = parseFeed(text, source.id);
			const previous = itemsBySource.get(source.id) ?? [];
			const chosen = parsed.length > 0 ? parsed : previous;
			const maxItems = source.maxItems ?? defaultMaxPerSource;

			itemsBySource.set(source.id, chosen.slice(0, maxItems));
			sources[source.id] = {
				lastFetchedAt: nowIso,
				error: null,
				count: Math.min(chosen.length, maxItems)
			};

			results.push({
				sourceId: source.id,
				name: source.name,
				ok: true,
				count: parsed.length,
				skipped: false
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			sources[source.id] = {
				lastFetchedAt: nowIso,
				error: message,
				count: status?.count ?? itemsBySource.get(source.id)?.length ?? 0
			};
			results.push({
				sourceId: source.id,
				name: source.name,
				ok: false,
				count: 0,
				skipped: false,
				error: message
			});
		}
	}

	const cutoff = now.getTime() - retentionMs;
	const seen = new Set<string>();
	const items: FeedItem[] = [];

	for (const list of itemsBySource.values()) {
		for (const item of list) {
			if (item.publishedAt) {
				const published = Date.parse(item.publishedAt);
				if (!Number.isNaN(published) && published < cutoff) continue;
			}
			if (seen.has(item.id)) continue;
			seen.add(item.id);
			items.push(item);
		}
	}

	items.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));

	return {
		cache: { version: 1, updatedAt: nowIso, items, sources },
		results
	};
}
