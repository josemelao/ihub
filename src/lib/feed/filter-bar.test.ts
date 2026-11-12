import { describe, expect, it } from 'vitest';
import { countActiveFeedFilters, shouldOpenFeedFilters } from './filter-bar';

describe('contador de filtros do feed', () => {
	it('não conta nada no estado padrão', () => {
		expect(
			countActiveFeedFilters({
				query: '',
				activeFilterId: null,
				categoryId: 'all',
				sourceId: 'all',
				unreadOnly: false
			})
		).toBe(0);
	});

	it('ignora busca só com espaços', () => {
		expect(countActiveFeedFilters({ query: '   ' })).toBe(0);
	});

	it('conta busca, filtro salvo, categoria, fonte e não lidos', () => {
		expect(
			countActiveFeedFilters({
				query: 'patch',
				activeFilterId: 'f1',
				categoryId: 'jogos',
				sourceId: 'steam',
				unreadOnly: true
			})
		).toBe(5);
	});

	it('conta cada filtro isolado', () => {
		expect(countActiveFeedFilters({ categoryId: 'jogos' })).toBe(1);
		expect(countActiveFeedFilters({ sourceId: 'steam' })).toBe(1);
		expect(countActiveFeedFilters({ unreadOnly: true })).toBe(1);
		expect(countActiveFeedFilters({ activeFilterId: 'f1' })).toBe(1);
	});

	it('abre a barra só quando há filtro ativo', () => {
		expect(shouldOpenFeedFilters({ categoryId: 'all', sourceId: 'all' })).toBe(false);
		expect(shouldOpenFeedFilters({ unreadOnly: true })).toBe(true);
	});
});
