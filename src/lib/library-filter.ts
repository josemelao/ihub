import { itemHasTag } from './tags';
import type { HubItem } from './types';

export type LibraryTab = 'todos' | 'app' | 'link';

export interface LibraryFilterOptions {
	tab: LibraryTab;
	query: string;
	tagKey: string;
}

function normalize(value: string): string {
	return value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase();
}

export function searchTerms(query: string): string[] {
	return normalize(query)
		.trim()
		.split(/\s+/)
		.filter((term) => term.length > 0);
}

/** Regra única de filtro da Biblioteca: tag, tipo e busca combinados. */
export function matchesLibraryItem(
	item: HubItem,
	categoryName: string,
	groupName: string,
	options: LibraryFilterOptions
): boolean {
	if (options.tagKey && !itemHasTag(item, options.tagKey)) return false;
	if (options.tab === 'app' && item.type !== 'app') return false;
	if (options.tab === 'link' && item.type !== 'link') return false;

	const terms = searchTerms(options.query);
	if (terms.length === 0) return true;

	const haystack = normalize(
		[item.name, categoryName, groupName, item.tags.join(' '), item.description ?? ''].join('\n')
	);
	return terms.every((term) => haystack.includes(term));
}
