export interface FeedFilterState {
	query?: string;
	activeFilterId?: string | null;
	categoryId?: string | null;
	sourceId?: string | null;
	unreadOnly?: boolean;
}

/** Quantos filtros estão realmente aplicados (para o contador do botão). */
export function countActiveFeedFilters(state: FeedFilterState): number {
	let count = 0;
	if (state.query?.trim()) count += 1;
	if (state.activeFilterId) count += 1;
	if (state.categoryId && state.categoryId !== 'all') count += 1;
	if (state.sourceId && state.sourceId !== 'all') count += 1;
	if (state.unreadOnly) count += 1;
	return count;
}

/**
 * A barra começa recolhida, mas abre sozinha quando já existe filtro aplicado
 * (deep link, URL com escopo ou estado restaurado) para não esconder o filtro.
 */
export function shouldOpenFeedFilters(state: FeedFilterState): boolean {
	return countActiveFeedFilters(state) > 0;
}
