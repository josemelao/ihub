import type { ArchiveIndex, HighlightsData, HubState } from '../types';
import type { SavedContentIndex } from './content-index';

/** Ritmo de leitura usado para estimar o tempo (palavras por minuto). */
export const WORDS_PER_MINUTE = 200;

export interface ReadingStats {
	saved: number;
	read: number;
	archived: number;
	highlights: number;
	words: number;
	minutes: number;
	withText: number;
}

export interface ReadingStatsInput {
	index: Pick<SavedContentIndex, 'docs' | 'savedCount' | 'savedWithText'>;
	state: Pick<HubState, 'saved' | 'read'>;
	highlights: Pick<HighlightsData, 'highlights'>;
	archive: Pick<ArchiveIndex, 'entries'>;
}

export function countWords(text: string): number {
	const trimmed = text.trim();
	if (!trimmed) return 0;
	return trimmed.split(/\s+/).length;
}

export function estimateReadingMinutes(words: number): number {
	if (words <= 0) return 0;
	return Math.ceil(words / WORDS_PER_MINUTE);
}

/** Estatísticas calculadas localmente a partir dos salvos e do que já está em disco. */
export function buildReadingStats({
	index,
	state,
	highlights,
	archive
}: ReadingStatsInput): ReadingStats {
	const saved = new Set(state.saved);
	const docs = index.docs.filter((doc) => saved.has(doc.itemId));
	const docsWithText = docs.filter((doc) => doc.text.trim().length > 0);

	let words = 0;
	for (const doc of docsWithText) words += countWords(doc.text);

	const read = state.saved.filter((id) => Boolean(state.read[id])).length;
	const archived = state.saved.filter((id) => archive.entries[id]?.status === 'ready').length;
	const highlightCount = highlights.highlights.filter((highlight) =>
		saved.has(highlight.itemId)
	).length;

	return {
		saved: state.saved.length,
		read,
		archived,
		highlights: highlightCount,
		words,
		minutes: estimateReadingMinutes(words),
		withText: docsWithText.length
	};
}
