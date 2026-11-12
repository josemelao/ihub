import { describe, expect, it } from 'vitest';
import { HOME_ACTIONS } from './home-actions';

describe('ações rápidas da home', () => {
	it('oferece cinco ações', () => {
		expect(HOME_ACTIONS).toHaveLength(5);
	});

	it('não repete os atalhos que já existem na sidebar', () => {
		const hrefs = HOME_ACTIONS.map((action) => action.href).filter(Boolean);
		expect(hrefs).not.toContain('/feed');
		expect(hrefs).not.toContain('/favoritos');
		expect(hrefs).not.toContain('/gerenciar');
	});

	it('inclui backup e exportação em Markdown', () => {
		const ids = HOME_ACTIONS.map((action) => action.id);
		expect(ids).toContain('backup');
		expect(ids).toContain('export-markdown');
		expect(HOME_ACTIONS.find((action) => action.id === 'export-markdown')?.href).toBe(
			'/api/export/markdown'
		);
	});

	it('exporta os links da Biblioteca em HTML', () => {
		expect(HOME_ACTIONS.find((action) => action.id === 'export-links')?.href).toBe(
			'/api/export/bookmarks'
		);
	});
});
