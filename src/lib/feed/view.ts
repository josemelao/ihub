import type {
	Category,
	FeedCache,
	FeedItem,
	FeedSource,
	HubData,
	HubState,
	SavedItemSnapshot
} from '../types';
import { toSafeHttpUrl } from '../net/url';
import { matchesSourceRules } from './filter';

export interface FeedViewItem {
	item: FeedItem;
	source: FeedSource;
	category?: Category;
	read: boolean;
	saved: boolean;
	savedAt?: string;
	/** Salvo sem cache nem snapshot utilizável: só dá para remover, não abrir. */
	missing?: boolean;
}

export function buildFeedView(
	hub: HubData,
	cache: FeedCache,
	state: HubState,
	options: { categoryId?: string; savedOnly?: boolean } = {}
): FeedViewItem[] {
	const sourceById = new Map(hub.feedSources.map((source) => [source.id, source]));
	const categoryById = new Map(hub.categories.map((category) => [category.id, category]));
	const saved = new Set(state.saved);
	const result: FeedViewItem[] = [];

	for (const item of cache.items) {
		const source = sourceById.get(item.sourceId);
		if (!source || !source.enabled) continue;
		const safeUrl = toSafeHttpUrl(item.url);
		if (!safeUrl) continue;
		const safeThumbnail = item.thumbnail ? toSafeHttpUrl(item.thumbnail) : null;
		const safeItem = { ...item, url: safeUrl, thumbnail: safeThumbnail };
		if (options.categoryId && source.categoryId !== options.categoryId) continue;
		if (!options.savedOnly && !matchesSourceRules(safeItem, source)) continue;
		if (options.savedOnly && !saved.has(safeItem.id)) continue;

		result.push({
			item: safeItem,
			source,
			category: categoryById.get(source.categoryId),
			read: Boolean(state.read[safeItem.id]),
			saved: saved.has(safeItem.id)
		});
	}

	return result.sort((a, b) => (b.item.publishedAt || '').localeCompare(a.item.publishedAt || ''));
}

export function snapshotFromEntry(entry: FeedViewItem): SavedItemSnapshot {
	return {
		item: entry.item,
		sourceId: entry.source.id,
		sourceName: entry.source.name,
		categoryId: entry.source.categoryId,
		categoryName: entry.category?.name,
		color: entry.category?.color,
		locale: entry.source.locale,
		savedAt: new Date().toISOString()
	};
}

/** Só faz sentido abrir quem tem URL real (o placeholder de salvo sem dados não tem). */
export function canOpenEntry(entry: FeedViewItem): boolean {
	return !entry.missing && Boolean(entry.item.url);
}

export function buildSavedView(hub: HubData, cache: FeedCache, state: HubState): FeedViewItem[] {
	const sourceById = new Map(hub.feedSources.map((source) => [source.id, source]));
	const categoryById = new Map(hub.categories.map((category) => [category.id, category]));
	const itemById = new Map(cache.items.map((item) => [item.id, item]));
	const result: FeedViewItem[] = [];

	for (const id of state.saved) {
		const liveItem = itemById.get(id);
		const liveSource = liveItem ? sourceById.get(liveItem.sourceId) : undefined;
		const liveUrl = liveItem ? toSafeHttpUrl(liveItem.url) : null;

		if (liveItem && liveSource && liveUrl) {
			result.push({
				item: {
					...liveItem,
					url: liveUrl,
					thumbnail: liveItem.thumbnail ? toSafeHttpUrl(liveItem.thumbnail) : null
				},
				source: liveSource,
				category: categoryById.get(liveSource.categoryId),
				read: Boolean(state.read[id]),
				saved: true,
				savedAt: state.savedItems?.[id]?.savedAt
			});
			continue;
		}

		const snapshot = state.savedItems?.[id];
		const snapshotUrl = snapshot ? toSafeHttpUrl(snapshot.item.url) : null;

		if (!snapshot || !snapshotUrl) {
			// Legado salvo antes de existir snapshot, ou snapshot com URL insegura:
			// aparece na lista para o usuário poder remover, sem link falso.
			result.push({
				item: {
					id,
					sourceId: 'desconhecida',
					title: 'Conteúdo indisponível',
					summary: 'Este post salvo perdeu os dados e não pode ser aberto.',
					url: '',
					publishedAt: '',
					thumbnail: null
				},
				source: {
					id: 'desconhecida',
					type: 'rss',
					name: 'Sem fonte',
					target: '',
					categoryId: 'salvos-sem-dados',
					intervalMinutes: 0,
					enabled: true,
					include: [],
					exclude: [],
					matchMode: 'any'
				},
				category: {
					id: 'salvos-sem-dados',
					name: 'Salvos sem dados',
					color: '#8AA4FF',
					order: 9999
				},
				read: Boolean(state.read[id]),
				saved: true,
				missing: true
			});
			continue;
		}
		const snapshotItem = {
			...snapshot.item,
			url: snapshotUrl,
			thumbnail: snapshot.item.thumbnail ? toSafeHttpUrl(snapshot.item.thumbnail) : null
		};

		const knownCategory = snapshot.categoryId ? categoryById.get(snapshot.categoryId) : undefined;
		const category: Category = knownCategory ?? {
			id: snapshot.categoryId ?? 'saved',
			name: snapshot.categoryName ?? 'Salvos',
			color: snapshot.color ?? '#8AA4FF',
			order: 9999
		};
		const source: FeedSource = {
			id: snapshot.sourceId,
			type: 'rss',
			name: snapshot.sourceName,
			target: '',
			categoryId: category.id,
			intervalMinutes: 0,
			locale: snapshot.locale,
			enabled: true,
			include: [],
			exclude: [],
			matchMode: 'any'
		};

		result.push({
			item: snapshotItem,
			source,
			category,
			read: Boolean(state.read[id]),
			saved: true,
			savedAt: snapshot.savedAt
		});
	}

	return result.sort((a, b) =>
		(b.savedAt ?? b.item.publishedAt ?? '').localeCompare(a.savedAt ?? a.item.publishedAt ?? '')
	);
}

export function backfillSavedSnapshots(hub: HubData, cache: FeedCache, state: HubState): HubState {
	const missing = state.saved.filter((id) => !state.savedItems[id]);
	if (missing.length === 0) return state;

	const sourceById = new Map(hub.feedSources.map((source) => [source.id, source]));
	const categoryById = new Map(hub.categories.map((category) => [category.id, category]));
	const itemById = new Map(cache.items.map((item) => [item.id, item]));
	const savedItems = { ...state.savedItems };
	let changed = false;

	for (const id of missing) {
		const item = itemById.get(id);
		if (!item) continue;
		const source = sourceById.get(item.sourceId);
		if (!source) continue;
		const category = categoryById.get(source.categoryId);
		savedItems[id] = {
			item,
			sourceId: source.id,
			sourceName: source.name,
			categoryId: source.categoryId,
			categoryName: category?.name,
			color: category?.color,
			locale: source.locale,
			savedAt: new Date().toISOString()
		};
		changed = true;
	}

	return changed ? { ...state, savedItems } : state;
}
