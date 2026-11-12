import type { FeedItem, ReadingArticle, SavedItemSnapshot } from '../types';

export interface ReaderItemInfo {
	id: string;
	title: string;
	url: string;
	summary: string;
	sourceId: string;
}

/**
 * Resolve o que o reader deve mostrar: item vivo do feed → snapshot salvo →
 * artigo em cache. Assim um post salvo continua legível depois de sair do cache.
 */
export function resolveReaderItem(
	item: FeedItem | undefined,
	snapshot: SavedItemSnapshot | undefined,
	article: ReadingArticle | null
): ReaderItemInfo | null {
	if (item) {
		return {
			id: item.id,
			title: item.title,
			url: item.url,
			summary: item.summary,
			sourceId: item.sourceId
		};
	}

	if (snapshot) {
		return {
			id: snapshot.item.id,
			title: snapshot.item.title,
			url: snapshot.item.url,
			summary: snapshot.item.summary,
			sourceId: snapshot.sourceId
		};
	}

	if (article) {
		return {
			id: article.id,
			title: article.title || article.url,
			url: article.url,
			summary: article.excerpt,
			sourceId: ''
		};
	}

	return null;
}
