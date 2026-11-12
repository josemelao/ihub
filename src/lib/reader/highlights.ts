import { createHash } from 'node:crypto';
import type { HighlightColor, HighlightsData, ReadingHighlight } from '../types';

export const HIGHLIGHT_COLORS: HighlightColor[] = ['yellow', 'green', 'blue', 'pink'];
export const HIGHLIGHT_COLOR_LABELS: Record<HighlightColor, string> = {
	yellow: 'amarelo',
	green: 'verde',
	blue: 'azul',
	pink: 'rosa'
};
export const MAX_HIGHLIGHT_QUOTE_LENGTH = 2_000;
export const MAX_HIGHLIGHT_NOTE_LENGTH = 2_000;

export type HighlightErrorCode =
	'empty-quote' | 'quote-too-long' | 'note-too-long' | 'invalid-color' | 'not-found';

export class HighlightError extends Error {
	readonly code: HighlightErrorCode;

	constructor(message: string, code: HighlightErrorCode) {
		super(message);
		this.name = 'HighlightError';
		this.code = code;
	}
}

export interface HighlightInput {
	itemId: string;
	itemTitle: string;
	itemUrl: string;
	quote: string;
	note?: string;
	color?: HighlightColor;
	occurrence?: number;
}

function nowIso(): string {
	return new Date().toISOString();
}

function highlightId(itemId: string, quote: string, occurrence: number): string {
	const digest = createHash('sha1')
		.update(`${itemId}\u0000${quote}\u0000${occurrence}`)
		.digest('hex');
	return `hl-${digest.slice(0, 16)}`;
}

function normalizeColor(value: HighlightColor | undefined): HighlightColor {
	if (value === undefined) return 'yellow';
	if (!HIGHLIGHT_COLORS.includes(value)) {
		throw new HighlightError('Cor de destaque inválida.', 'invalid-color');
	}
	return value;
}

function normalizeNote(value: string | undefined): string | undefined {
	if (value === undefined) return undefined;
	const note = value.trim();
	if (note.length > MAX_HIGHLIGHT_NOTE_LENGTH) {
		throw new HighlightError('Nota do destaque é longa demais.', 'note-too-long');
	}
	return note || undefined;
}

export function addHighlight(
	data: HighlightsData,
	input: HighlightInput,
	at: string = nowIso()
): HighlightsData {
	const quote = input.quote.trim();
	if (!quote) throw new HighlightError('O destaque não pode ficar vazio.', 'empty-quote');
	if (quote.length > MAX_HIGHLIGHT_QUOTE_LENGTH) {
		throw new HighlightError('Trecho do destaque é longo demais.', 'quote-too-long');
	}

	const color = normalizeColor(input.color);
	const note = normalizeNote(input.note);
	const occurrence = Math.max(0, Math.trunc(input.occurrence ?? 0));
	const id = highlightId(input.itemId, quote, occurrence);
	const existing = data.highlights.find((highlight) => highlight.id === id);

	if (existing) {
		const updated: ReadingHighlight = {
			...existing,
			color,
			updatedAt: at,
			...(note !== undefined ? { note } : {})
		};
		return {
			...data,
			highlights: data.highlights.map((highlight) => (highlight.id === id ? updated : highlight))
		};
	}

	const highlight: ReadingHighlight = {
		id,
		itemId: input.itemId,
		itemTitle: input.itemTitle,
		itemUrl: input.itemUrl,
		quote,
		...(note !== undefined ? { note } : {}),
		color,
		occurrence,
		createdAt: at,
		updatedAt: at
	};

	return { ...data, highlights: [...data.highlights, highlight] };
}

export function updateHighlight(
	data: HighlightsData,
	id: string,
	patch: { note?: string | null; color?: HighlightColor },
	at: string = nowIso()
): HighlightsData {
	const existing = data.highlights.find((highlight) => highlight.id === id);
	if (!existing) throw new HighlightError('Destaque não encontrado.', 'not-found');

	const color = patch.color === undefined ? existing.color : normalizeColor(patch.color);
	const note =
		patch.note === null
			? undefined
			: patch.note === undefined
				? existing.note
				: normalizeNote(patch.note);

	const updated: ReadingHighlight = {
		...existing,
		color,
		updatedAt: at,
		...(note !== undefined ? { note } : {})
	};
	if (note === undefined) delete updated.note;

	return {
		...data,
		highlights: data.highlights.map((highlight) => (highlight.id === id ? updated : highlight))
	};
}

export function removeHighlight(data: HighlightsData, id: string): HighlightsData {
	const highlights = data.highlights.filter((highlight) => highlight.id !== id);
	return highlights.length === data.highlights.length ? data : { ...data, highlights };
}

export function highlightsForItem(data: HighlightsData, itemId: string): ReadingHighlight[] {
	return data.highlights
		.filter((highlight) => highlight.itemId === itemId)
		.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
