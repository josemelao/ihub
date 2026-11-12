import { fetchPublicText } from '../net/safe-fetch';
import { toSafeHttpUrl } from '../net/url';
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
	const { text, finalUrl } = await fetchText(url);
	const extracted = extractReadable(text, finalUrl);
	const now = options.now ?? (() => new Date());

	const article: ReadingArticle = {
		id: item.id,
		url,
		finalUrl,
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
	return article;
}
