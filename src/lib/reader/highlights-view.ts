import type { HighlightColor, ReadingHighlight } from '../types';
import { normalize } from '../text/normalize';

export interface HighlightGroup {
	itemId: string;
	itemTitle: string;
	itemUrl: string;
	highlights: ReadingHighlight[];
}

/** Agrupa por post; dentro do grupo, do destaque mais antigo para o mais novo. */
export function groupHighlights(highlights: ReadingHighlight[]): HighlightGroup[] {
	const byItem = new Map<string, ReadingHighlight[]>();
	for (const highlight of highlights) {
		const list = byItem.get(highlight.itemId);
		if (list) list.push(highlight);
		else byItem.set(highlight.itemId, [highlight]);
	}

	return [...byItem.entries()]
		.map(([itemId, list]) => {
			const ordered = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
			return {
				itemId,
				itemTitle: ordered[0].itemTitle,
				itemUrl: ordered[0].itemUrl,
				highlights: ordered
			};
		})
		.sort((a, b) => {
			const latestA = a.highlights.reduce(
				(latest, highlight) => (highlight.updatedAt > latest ? highlight.updatedAt : latest),
				''
			);
			const latestB = b.highlights.reduce(
				(latest, highlight) => (highlight.updatedAt > latest ? highlight.updatedAt : latest),
				''
			);
			return latestB.localeCompare(latestA);
		});
}

export function totalHighlights(groups: HighlightGroup[]): number {
	return groups.reduce((total, group) => total + group.highlights.length, 0);
}

export type HighlightColorFilter = HighlightColor | 'all';

export interface HighlightFilter {
	query?: string;
	color?: HighlightColorFilter;
}

export function countByColor(highlights: ReadingHighlight[]): Record<HighlightColorFilter, number> {
	const counts: Record<HighlightColorFilter, number> = {
		all: highlights.length,
		yellow: 0,
		green: 0,
		blue: 0,
		pink: 0
	};
	for (const highlight of highlights) counts[highlight.color] += 1;
	return counts;
}

/**
 * Filtra por texto (título, trecho e nota, sem acento/caixa) e por cor.
 * Grupos que ficaram sem trechos são removidos.
 */
export function filterHighlights(
	groups: HighlightGroup[],
	filter: HighlightFilter
): HighlightGroup[] {
	const terms = (filter.query ?? '').trim().split(/\s+/).filter(Boolean).map(normalize);
	const color = filter.color ?? 'all';
	if (terms.length === 0 && color === 'all') return groups;

	return groups
		.map((group) => ({
			...group,
			highlights: group.highlights.filter((highlight) => {
				if (color !== 'all' && highlight.color !== color) return false;
				if (terms.length === 0) return true;
				const haystack = normalize(
					`${group.itemTitle}\n${highlight.quote}\n${highlight.note ?? ''}`
				);
				return terms.every((term) => haystack.includes(term));
			})
		}))
		.filter((group) => group.highlights.length > 0);
}
