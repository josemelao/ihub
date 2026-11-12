import type { ReadingHighlight } from '../types';

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
			const latestA = a.highlights[a.highlights.length - 1]?.updatedAt ?? '';
			const latestB = b.highlights[b.highlights.length - 1]?.updatedAt ?? '';
			return latestB.localeCompare(latestA);
		});
}
