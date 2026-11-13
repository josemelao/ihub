import { getStorage } from '../storage';
import type { HubStorage } from '../types';
import type { ContentDoc } from './content-search';

const MAX_INDEX_CHARS = 50_000;

export interface SavedContentIndex {
	docs: ContentDoc[];
	savedCount: number;
	savedWithText: number;
}

type IndexStorage = Pick<HubStorage, 'loadState' | 'listArticleIds' | 'loadArticle'>;

let version = 0;
let cache: { signature: string; value: SavedContentIndex } | null = null;

/** Chamado quando um artigo é extraído ou apagado. */
export function invalidateContentIndex(): void {
	version += 1;
}

/** Reset usado pelos testes; não chame em produção. */
export function resetContentIndex(): void {
	version = 0;
	cache = null;
}

function cleanText(text: string): string {
	return text.replace(/\s+/g, ' ').trim().slice(0, MAX_INDEX_CHARS);
}

export async function getSavedContentIndex(
	storage: IndexStorage = getStorage()
): Promise<SavedContentIndex> {
	const state = await storage.loadState();
	const saved = [...state.saved];
	const signature = `${version}|${[...saved].sort().join(',')}`;
	if (cache?.signature === signature) return cache.value;

	const available = new Set(await storage.listArticleIds());
	const docs: ContentDoc[] = [];
	let savedWithText = 0;

	await Promise.all(
		saved.map(async (itemId) => {
			const snapshot = state.savedItems?.[itemId];
			let text = '';
			if (available.has(itemId)) {
				try {
					const article = await storage.loadArticle(itemId);
					text = cleanText(article?.text ?? '');
				} catch {
					text = '';
				}
			}
			if (text) savedWithText += 1;

			const title = snapshot?.item.title ?? '';
			if (!title && !text) return;

			docs.push({
				itemId,
				title: title || itemId,
				url: snapshot?.item.url ?? '',
				sourceName: snapshot?.sourceName ?? '',
				savedAt: snapshot?.savedAt,
				publishedAt: snapshot?.item.publishedAt,
				text
			});
		})
	);

	const value: SavedContentIndex = { docs, savedCount: saved.length, savedWithText };
	value.docs.sort((a, b) => a.itemId.localeCompare(b.itemId));
	cache = { signature, value };
	return value;
}
