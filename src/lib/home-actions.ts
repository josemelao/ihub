export type HomeActionId =
	'refresh' | 'backup' | 'export-data' | 'export-markdown' | 'export-links';

export interface HomeAction {
	id: HomeActionId;
	label: string;
	icon: string;
	href?: string;
	download?: boolean;
}

// Ações de manutenção: o que já é navegação (Feed, Favoritos, Gerenciar) fica na
// sidebar e não se repete aqui.
export const HOME_ACTIONS: HomeAction[] = [
	{ id: 'refresh', label: 'Atualizar agora', icon: 'rss' },
	{ id: 'backup', label: 'Backup agora', icon: 'archive' },
	{
		id: 'export-data',
		label: 'Exportar dados',
		icon: 'download',
		href: '/api/export',
		download: true
	},
	{
		id: 'export-markdown',
		label: 'Exportar Markdown',
		icon: 'book',
		href: '/api/export/markdown',
		download: true
	},
	{
		id: 'export-links',
		label: 'Exportar links (HTML)',
		icon: 'bookmark',
		href: '/api/export/bookmarks',
		download: true
	}
];
