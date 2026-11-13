import type { FeedItem, FeedSource, MatchMode } from '../types';
import { normalize, normalizeWithMap } from '../text/normalize';

export { normalize } from '../text/normalize';

function normalizedTerms(terms: string[]): string[] {
	return terms.map((term) => normalize(term).trim()).filter(Boolean);
}

export function matchesFilter(
	text: string,
	include: string[],
	exclude: string[],
	matchMode: MatchMode
): boolean {
	const normalized = normalize(text);
	const excluded = normalizedTerms(exclude);
	if (excluded.some((term) => normalized.includes(term))) {
		return false;
	}

	const included = normalizedTerms(include);
	if (included.length === 0) {
		return true;
	}

	return matchMode === 'all'
		? included.every((term) => normalized.includes(term))
		: included.some((term) => normalized.includes(term));
}

export function matchesSourceRules(item: FeedItem, source: FeedSource): boolean {
	return matchesFilter(
		`${item.title}\n${item.summary}`,
		source.include,
		source.exclude,
		source.matchMode
	);
}

export interface HighlightSegment {
	text: string;
	highlight: boolean;
}

export function splitHighlights(text: string, terms: string[]): HighlightSegment[] {
	const { normalized, map } = normalizeWithMap(text);
	const ranges: { start: number; end: number }[] = [];

	for (const term of normalizedTerms(terms)) {
		let from = 0;
		while (from <= normalized.length) {
			const found = normalized.indexOf(term, from);
			if (found === -1) break;
			const start = map[found];
			const end = map[found + term.length - 1] + 1;
			ranges.push({ start, end });
			from = found + term.length;
		}
	}

	if (ranges.length === 0) {
		return [{ text, highlight: false }];
	}

	ranges.sort((a, b) => a.start - b.start);
	const merged: { start: number; end: number }[] = [];
	for (const range of ranges) {
		const last = merged[merged.length - 1];
		if (last && range.start <= last.end) {
			last.end = Math.max(last.end, range.end);
		} else {
			merged.push({ ...range });
		}
	}

	const segments: HighlightSegment[] = [];
	let cursor = 0;
	for (const range of merged) {
		if (range.start > cursor) {
			segments.push({ text: text.slice(cursor, range.start), highlight: false });
		}
		segments.push({ text: text.slice(range.start, range.end), highlight: true });
		cursor = range.end;
	}
	if (cursor < text.length) {
		segments.push({ text: text.slice(cursor), highlight: false });
	}

	return segments;
}
