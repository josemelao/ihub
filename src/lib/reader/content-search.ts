import type { HighlightColor, ReadingHighlight } from '../types';
import { findSnippet, normalize } from '../text/normalize';

export interface ContentDoc {
	itemId: string;
	title: string;
	url: string;
	sourceName: string;
	savedAt?: string;
	/** Texto extraído já limpo; vazio quando o post não passou pelo leitor. */
	text: string;
}

export interface ContentSnippet {
	before: string;
	match: string;
	after: string;
}

export interface ContentMatch {
	kind: 'text' | 'highlight';
	snippet: ContentSnippet;
	highlightId?: string;
	color?: HighlightColor;
	note?: string;
}

export interface ContentGroup {
	itemId: string;
	title: string;
	url: string;
	sourceName: string;
	saved: boolean;
	savedAt?: string;
	matches: ContentMatch[];
}

export interface ContentCoverage {
	saved: number;
	savedWithText: number;
}

export interface ContentSearchResult {
	query: string;
	total: number;
	hasMore: boolean;
	groups: ContentGroup[];
	outside: ContentGroup[];
	coverage: ContentCoverage;
}

export interface SearchContentInput {
	docs: ContentDoc[];
	highlights: ReadingHighlight[];
	query: string;
	limit: number;
	coverage: ContentCoverage;
}

const MAX_MATCHES_PER_GROUP = 3;
const MAX_OUTSIDE = 20;

function termsOf(query: string): string[] {
	return query.trim().split(/\s+/).filter(Boolean);
}

function matchesAll(text: string, terms: string[]): boolean {
	const haystack = normalize(text);
	return terms.every((term) => haystack.includes(normalize(term)));
}

function highlightSnippet(highlight: ReadingHighlight, terms: string[]): ContentSnippet {
	const text = highlight.note ? `${highlight.quote} — ${highlight.note}` : highlight.quote;
	return findSnippet(text, terms, 120) ?? { before: '', match: text, after: '' };
}

export function searchContent(input: SearchContentInput): ContentSearchResult {
	const terms = termsOf(input.query);
	const empty: ContentSearchResult = {
		query: input.query,
		total: 0,
		hasMore: false,
		groups: [],
		outside: [],
		coverage: input.coverage
	};
	if (terms.length === 0) return empty;

	const highlightsByItem = new Map<string, ReadingHighlight[]>();
	for (const highlight of input.highlights) {
		const list = highlightsByItem.get(highlight.itemId) ?? [];
		list.push(highlight);
		highlightsByItem.set(highlight.itemId, list);
	}

	const savedIds = new Set(input.docs.map((doc) => doc.itemId));
	const groups: ContentGroup[] = [];

	for (const doc of input.docs) {
		const matches: ContentMatch[] = [];
		const itemHighlights = (highlightsByItem.get(doc.itemId) ?? []).filter((highlight) =>
			matchesAll(`${highlight.itemTitle}\n${highlight.quote}\n${highlight.note ?? ''}`, terms)
		);

		for (const highlight of itemHighlights) {
			if (matches.length >= MAX_MATCHES_PER_GROUP) break;
			matches.push({
				kind: 'highlight',
				highlightId: highlight.id,
				color: highlight.color,
				note: highlight.note,
				snippet: highlightSnippet(highlight, terms)
			});
		}

		const duplicado = itemHighlights.some(
			(highlight) => highlight.quote && normalize(doc.text).includes(normalize(highlight.quote))
		);
		if (matches.length < MAX_MATCHES_PER_GROUP && !duplicado && matchesAll(doc.text, terms)) {
			const snippet = findSnippet(doc.text, terms, 80);
			if (snippet) matches.push({ kind: 'text', snippet });
		}

		if (matches.length === 0) continue;
		groups.push({
			itemId: doc.itemId,
			title: doc.title,
			url: doc.url,
			sourceName: doc.sourceName,
			saved: true,
			savedAt: doc.savedAt,
			matches
		});
	}

	groups.sort((a, b) => (b.savedAt ?? '').localeCompare(a.savedAt ?? ''));

	const outside: ContentGroup[] = [];
	for (const [itemId, itemHighlights] of highlightsByItem) {
		if (savedIds.has(itemId)) continue;
		const matches = itemHighlights
			.filter((highlight) =>
				matchesAll(`${highlight.itemTitle}\n${highlight.quote}\n${highlight.note ?? ''}`, terms)
			)
			.slice(0, MAX_MATCHES_PER_GROUP)
			.map<ContentMatch>((highlight) => ({
				kind: 'highlight',
				highlightId: highlight.id,
				color: highlight.color,
				note: highlight.note,
				snippet: highlightSnippet(highlight, terms)
			}));
		if (matches.length === 0) continue;

		const latest = itemHighlights
			.map((highlight) => highlight.updatedAt)
			.sort()
			.reverse()[0];
		outside.push({
			itemId,
			title: itemHighlights[0].itemTitle,
			url: itemHighlights[0].itemUrl,
			sourceName: '',
			saved: false,
			savedAt: latest,
			matches
		});
	}

	outside.sort((a, b) => (b.savedAt ?? '').localeCompare(a.savedAt ?? ''));

	const hasMore = groups.length > input.limit;
	const limited = groups.slice(0, Math.max(0, input.limit));
	const cappedOutside = outside.slice(0, MAX_OUTSIDE);

	return {
		query: input.query,
		total: limited.length + cappedOutside.length,
		hasMore,
		groups: limited,
		outside: cappedOutside,
		coverage: input.coverage
	};
}
