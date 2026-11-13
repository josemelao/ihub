import { fetchPublicText } from '../net/safe-fetch';
import { toSafeHttpUrl } from '../net/url';
import { invalidateContentIndex } from './content-index';
import type { FeedItem, HubStorage, ReadingArticle } from '../types';
import { extractReadable, ReaderError } from './extract';

export type TextFetcher = (url: string) => Promise<{ text: string; finalUrl: string }>;

export interface ExtractOptions {
	fetchText?: TextFetcher;
	now?: () => Date;
}

function defaultFetcher(url: string): Promise<{ text: string; finalUrl: string }> {
	return fetchPublicText(url, { maxBytes: 5_000_000, timeoutMs: 10_000 });
}

/** Lê o artigo do cache ou busca, extrai, sanitiza e grava. */
export async function getOrExtractArticle(
	storage: Pick<HubStorage, 'loadArticle' | 'saveArticle'>,
	item: FeedItem,
	options: ExtractOptions = {}
): Promise<ReadingArticle> {
	const cached = await storage.loadArticle(item.id);
	if (cached) return cached;

	const url = toSafeHttpUrl(item.url);
	if (!url) throw new ReaderError('URL do post inválida.', 'invalid-url');

	const fetchText = options.fetchText ?? defaultFetcher;
	let fetched: { text: string; finalUrl: string };
	try {
		fetched = await fetchText(url);
	} catch (error) {
		const message =
			error instanceof Error && error.message
				? error.message
				: 'Não foi possível buscar a página para leitura.';
		throw new ReaderError(message, 'fetch-failed');
	}

	const extracted = extractReadable(fetched.text, fetched.finalUrl);
	const now = options.now ?? (() => new Date());

	const article: ReadingArticle = {
		id: item.id,
		url,
		finalUrl: fetched.finalUrl,
		title: extracted.title || item.title,
		byline: extracted.byline,
		siteName: extracted.siteName,
		excerpt: extracted.excerpt || item.summary.slice(0, 300),
		publishedAt: item.publishedAt,
		fetchedAt: now().toISOString(),
		length: extracted.length,
		html: extracted.html,
		text: extracted.text
	};

	await storage.saveArticle(article);
	invalidateContentIndex();
	return article;
}
