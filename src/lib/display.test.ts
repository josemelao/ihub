import { describe, it, expect } from 'vitest';
import {
	appIconCandidates,
	categoryItemCounts,
	categorySourceCounts,
	contrastText,
	faviconCandidates,
	initials,
	itemIconCandidates,
	relativeTime,
	tint
} from './display';
import type { HubData, HubItem } from './types';

describe('initials', () => {
	it('usa as iniciais das duas primeiras palavras', () => {
		expect(initials('Abrir Darktide')).toBe('AD');
	});
	it('usa duas letras quando há uma palavra só', () => {
		expect(initials('Steam')).toBe('ST');
	});
	it('ignora espaços extras', () => {
		expect(initials('  Wiki   da comunidade ')).toBe('WD');
	});
});

describe('tint', () => {
	it('converte hex para rgba com transparência', () => {
		expect(tint('#8AA4FF', 0.15)).toBe('rgba(138, 164, 255, 0.15)');
	});
});

describe('contrastText', () => {
	it('usa texto escuro em accent claro', () => {
		expect(contrastText('#8AA4FF')).toBe('#0b1020');
		expect(contrastText('#FFFFFF')).toBe('#0b1020');
	});

	it('usa texto branco em accent escuro', () => {
		expect(contrastText('#101828')).toBe('#ffffff');
		expect(contrastText('#B42318')).toBe('#ffffff');
	});
});

describe('relativeTime', () => {
	const now = new Date('2026-11-09T12:00:00.000Z').getTime();

	it('mostra minutos', () => {
		expect(relativeTime('2026-11-09T11:35:00.000Z', now)).toBe('há 25 min');
	});

	it('mostra horas', () => {
		expect(relativeTime('2026-11-09T11:00:00.000Z', now)).toBe('há 1 h');
	});

	it('mostra ontem', () => {
		expect(relativeTime('2026-11-08T10:00:00.000Z', now)).toBe('ontem');
	});

	it('mostra dias', () => {
		expect(relativeTime('2026-11-06T12:00:00.000Z', now)).toBe('há 3 dias');
	});

	it('lida com data ausente', () => {
		expect(relativeTime('', now)).toBe('sem data');
	});
});

describe('categoryItemCounts', () => {
	it('conta itens por categoria', () => {
		const hub = {
			version: 1,
			settings: { accent: '#8AA4FF' },
			categories: [
				{ id: 'a', name: 'A', color: '#fff', order: 1 },
				{ id: 'b', name: 'B', color: '#fff', order: 2 }
			],
			items: [
				{
					id: '1',
					type: 'link',
					name: '1',
					url: 'https://a.com',
					categoryId: 'a',
					tags: [],
					pinned: false,
					order: 0
				},
				{
					id: '2',
					type: 'link',
					name: '2',
					url: 'https://b.com',
					categoryId: 'b',
					tags: [],
					pinned: false,
					order: 0
				},
				{
					id: '3',
					type: 'link',
					name: '3',
					url: 'https://c.com',
					categoryId: 'a',
					tags: [],
					pinned: false,
					order: 0
				}
			],
			groups: [],
			feedSources: [],
			savedFilters: []
		} as HubData;

		expect(categoryItemCounts(hub)).toEqual({ a: 2, b: 1 });
	});
});

describe('categorySourceCounts', () => {
	it('conta fontes de feed por categoria', () => {
		const hub = {
			version: 1,
			settings: { accent: '#8AA4FF' },
			categories: [],
			groups: [],
			items: [],
			feedSources: [
				{ id: 's1', type: 'rss', name: '1', target: 'x', categoryId: 'a' },
				{ id: 's2', type: 'reddit', name: '2', target: 'y', categoryId: 'a' },
				{ id: 's3', type: 'youtube', name: '3', target: 'z', categoryId: 'b' }
			],
			savedFilters: []
		} as unknown as HubData;

		expect(categorySourceCounts(hub)).toEqual({ a: 2, b: 1 });
	});
});

describe('ícones', () => {
	const link: HubItem = {
		id: 'github',
		type: 'link',
		name: 'GitHub',
		url: 'https://github.com/user',
		categoryId: 'ferramentas',
		tags: [],
		pinned: false,
		order: 0
	};

	const app: HubItem = {
		id: 'steam',
		type: 'app',
		name: 'Steam',
		launch: { kind: 'protocol', value: 'steam://open/main' },
		categoryId: 'jogos',
		tags: [],
		pinned: false,
		order: 0
	};

	it('gera candidatos de favicon pelo host do link', () => {
		const candidates = faviconCandidates('https://github.com/user');
		expect(candidates[0]).toBe('https://icons.duckduckgo.com/ip3/github.com.ico');
		expect(candidates[1]).toBe('https://www.google.com/s2/favicons?domain=github.com&sz=64');
		expect(candidates[2]).toBe('https://github.com/favicon.ico');
		expect(faviconCandidates('url-invalida')).toEqual([]);
	});

	it('mapeia protocolo de app para o domínio oficial antes do Simple Icons', () => {
		const steam = appIconCandidates('steam://open/main');
		expect(steam[0]).toBe('https://icons.duckduckgo.com/ip3/store.steampowered.com.ico');
		expect(steam).toContain('https://cdn.simpleicons.org/steam');

		const vscode = appIconCandidates('vscode://');
		expect(vscode[0]).toBe('https://icons.duckduckgo.com/ip3/code.visualstudio.com.ico');
		expect(vscode.join(' ')).not.toContain('visualstudiocode');

		expect(appIconCandidates('desconhecido://')).toEqual([]);
	});

	it('prioriza o ícone personalizado e mantém os fallbacks', () => {
		const slug = itemIconCandidates({ ...link, icon: 'github' });
		expect(slug[0]).toBe('https://cdn.simpleicons.org/github');
		expect(slug[1]).toContain('icons.duckduckgo.com/ip3/github.com.ico');

		const url = itemIconCandidates({ ...link, icon: 'https://example.com/a.png' });
		expect(url[0]).toBe('https://example.com/a.png');
		expect(url[1]).toContain('icons.duckduckgo.com');
	});

	it('usa favicon para link e domínio do protocolo para app', () => {
		expect(itemIconCandidates(link)[0]).toContain('icons.duckduckgo.com/ip3/github.com.ico');
		expect(itemIconCandidates(app)[0]).toContain('store.steampowered.com');
	});
});
