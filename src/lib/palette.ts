import { buildSearchEntries } from './search';
import { tagKey } from './tags';
import type { FeedCache, HubData, HubState, NotesData } from './types';

export type PaletteType = 'command' | 'category' | 'link' | 'app' | 'post' | 'note' | 'source';

export interface PaletteItem {
	id: string;
	type: PaletteType;
	title: string;
	description: string;
	href?: string;
	commandId?: string;
	color: string;
	keywords?: string[];
	/** Só para posts: estado de leitura/salvo e nome da fonte. */
	unread?: boolean;
	saved?: boolean;
	sourceName?: string;
}

const COMMANDS: PaletteItem[] = [
	{
		id: 'command:add-link',
		type: 'command',
		title: 'Adicionar link',
		description: 'Abre o editor de itens',
		href: '/gerenciar?tab=itens&add=link',
		commandId: 'add-link',
		color: '#8AA4FF',
		keywords: ['adicionar', 'novo', 'link', 'item', 'criar']
	},
	{
		id: 'command:add-source',
		type: 'command',
		title: 'Adicionar fonte',
		description: 'RSS, YouTube ou Reddit',
		href: '/gerenciar?tab=fontes&add=source',
		commandId: 'add-source',
		color: '#8AA4FF',
		keywords: ['adicionar', 'nova', 'fonte', 'feed', 'rss', 'youtube', 'reddit']
	},
	{
		id: 'command:add-category',
		type: 'command',
		title: 'Nova categoria',
		description: 'Gerenciar → Categorias',
		href: '/gerenciar?tab=categorias&add=1',
		commandId: 'add-category',
		color: '#8AA4FF',
		keywords: ['adicionar', 'nova', 'categoria']
	},
	{
		id: 'command:manage',
		type: 'command',
		title: 'Abrir Gerenciar',
		description: 'Fontes, itens, categorias e backups',
		href: '/gerenciar',
		commandId: 'manage',
		color: '#8AA4FF',
		keywords: ['gerenciar', 'editar', 'configurar']
	},
	{
		id: 'command:library',
		type: 'command',
		title: 'Ir para Biblioteca',
		description: 'Links e apps',
		href: '/biblioteca',
		commandId: 'library',
		color: '#8AA4FF',
		keywords: ['biblioteca', 'links', 'apps']
	},
	{
		id: 'command:feed',
		type: 'command',
		title: 'Ir para o feed',
		description: 'Posts de todas as fontes',
		href: '/feed',
		commandId: 'feed',
		color: '#8AA4FF',
		keywords: ['feed', 'posts', 'noticias']
	},
	{
		id: 'command:saved',
		type: 'command',
		title: 'Ir para Salvos',
		description: 'Posts salvos para depois',
		href: '/favoritos',
		commandId: 'saved',
		color: '#8AA4FF',
		keywords: ['salvos', 'favoritos', 'ler']
	},
	{
		id: 'command:export',
		type: 'command',
		title: 'Exportar dados',
		description: 'Baixa hub, estado e notas',
		href: '/api/export',
		commandId: 'export',
		color: '#8AA4FF',
		keywords: ['exportar', 'backup', 'baixar']
	},
	{
		id: 'command:refresh',
		type: 'command',
		title: 'Atualizar feed',
		description: 'Busca novas postagens agora',
		commandId: 'refresh',
		color: '#8AA4FF',
		keywords: ['atualizar', 'refresh', 'buscar', 'feed']
	}
];

function normalize(value: string): string {
	return value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase();
}

export interface PaletteIndexInput {
	hub: HubData;
	feed?: FeedCache;
	state?: HubState;
	notes?: NotesData;
}

/** Índice plano com tudo que a palette pode encontrar. */
export function buildPaletteItems(input: PaletteIndexInput): PaletteItem[] {
	const { hub, feed, state, notes } = input;
	const sourceById = new Map(hub.feedSources.map((source) => [source.id, source]));
	const saved = new Set(state?.saved ?? []);
	const read = state?.read ?? {};
	const items: PaletteItem[] = [...COMMANDS];

	for (const entry of buildSearchEntries(hub, feed)) {
		if (entry.type === 'post') {
			const postId = entry.id.replace(/^post:/, '');
			const post = feed?.items.find((candidate) => candidate.id === postId);
			const source = post ? sourceById.get(post.sourceId) : undefined;
			items.push({
				id: `entry:${entry.id}`,
				type: 'post',
				title: entry.name,
				description: entry.description,
				href: entry.href,
				color: entry.color,
				keywords: [],
				unread: !read[postId],
				saved: saved.has(postId),
				sourceName: source?.name ?? ''
			});
			continue;
		}

		items.push({
			id: `entry:${entry.id}`,
			type: entry.type === 'category' ? 'category' : entry.type,
			title: entry.name,
			description: entry.description,
			href: entry.href,
			color: entry.color,
			keywords: entry.tags
		});
	}

	for (const source of hub.feedSources) {
		items.push({
			id: `source:${source.id}`,
			type: 'source',
			title: source.name,
			description: source.target,
			href: `/feed?fonte=${encodeURIComponent(source.id)}`,
			color: '#8AA4FF',
			keywords: [source.type, source.target]
		});
	}

	for (const note of notes?.notes ?? []) {
		items.push({
			id: `note:${note.id}`,
			type: 'note',
			title: note.text.slice(0, 80),
			description: 'Nota',
			href: '/#t-nota',
			color: '#8AA4FF',
			keywords: [note.text]
		});
	}

	// Salvos que não estão entre os posts recentes (ou só existem no snapshot).
	const postIds = new Set(items.filter((item) => item.type === 'post').map((item) => item.id));
	for (const id of state?.saved ?? []) {
		const key = `entry:post:${id}`;
		if (postIds.has(key)) continue;
		const snapshot = state?.savedItems?.[id];
		const live = feed?.items.find((candidate) => candidate.id === id);
		const title = live?.title ?? snapshot?.item.title;
		const url = live?.url ?? snapshot?.item.url;
		if (!title || !url) continue;
		items.push({
			id: key,
			type: 'post',
			title,
			description: [snapshot?.sourceName, 'salvo'].filter(Boolean).join(' · '),
			href: url,
			color: snapshot?.color ?? '#8AA4FF',
			saved: true,
			unread: false,
			sourceName: snapshot?.sourceName ?? ''
		});
	}

	return items;
}

export interface ParsedPaletteQuery {
	commandsOnly: boolean;
	text: string;
	tag?: string;
	source?: string;
	unread: boolean;
	saved: boolean;
}

export function parsePaletteQuery(raw: string): ParsedPaletteQuery {
	let rest = raw;
	const parsed: ParsedPaletteQuery = {
		commandsOnly: false,
		text: '',
		unread: false,
		saved: false
	};

	if (rest.startsWith('>')) {
		parsed.commandsOnly = true;
		rest = rest.slice(1);
	}

	const terms: string[] = [];
	for (const token of rest.split(/\s+/).filter(Boolean)) {
		const [prefix, ...valueParts] = token.split(':');
		const value = valueParts.join(':');
		if (prefix === 'tag' && value) parsed.tag = value;
		else if (prefix === 'source' && value) parsed.source = value;
		else if (prefix === 'is' && value === 'unread') parsed.unread = true;
		else if (prefix === 'is' && value === 'saved') parsed.saved = true;
		else terms.push(token);
	}

	parsed.text = terms.join(' ').trim();
	return parsed;
}

interface ScoredItem {
	item: PaletteItem;
	score: number;
}

/** Busca com operadores simples; sem Fuse para manter a paleta instantânea. */
export function searchPalette(index: PaletteItem[], raw: string, limit = 10): PaletteItem[] {
	const query = parsePaletteQuery(raw);
	const text = normalize(query.text);
	const tag = query.tag ? tagKey(query.tag) : null;
	const source = query.source ? normalize(query.source) : null;
	const results: ScoredItem[] = [];

	for (const item of index) {
		if (query.commandsOnly && item.type !== 'command') continue;
		if (tag) {
			if (item.type !== 'link' && item.type !== 'app') continue;
			if (!(item.keywords ?? []).some((keyword) => tagKey(keyword) === tag)) continue;
		}
		if (query.unread && (item.type !== 'post' || !item.unread)) continue;
		if (query.saved && (item.type !== 'post' || !item.saved)) continue;
		if (source) {
			if (item.type !== 'post') continue;
			const haystack = normalize(`${item.sourceName ?? ''} ${item.description}`);
			if (!haystack.includes(source)) continue;
		}

		if (!text) {
			results.push({ item, score: item.type === 'command' ? 0 : 1 });
			continue;
		}

		const title = normalize(item.title);
		const description = normalize(item.description);
		const keywords = normalize(`${(item.keywords ?? []).join(' ')} ${item.sourceName ?? ''}`);
		const haystack = `${title} ${description} ${keywords}`;
		const terms = text.split(/\s+/).filter(Boolean);

		// Todos os termos precisam aparecer em algum campo (busca multi-palavra).
		if (!terms.every((term) => haystack.includes(term))) continue;

		let score = 0;
		for (const term of terms) {
			if (title.startsWith(term)) score += 5;
			else if (title.includes(term)) score += 4;
			else if (keywords.includes(term)) score += 3;
			else score += 2;
		}

		results.push({ item, score });
	}

	results.sort((a, b) =>
		text
			? b.score - a.score || a.item.title.localeCompare(b.item.title, 'pt-BR')
			: a.score - b.score || a.item.title.localeCompare(b.item.title, 'pt-BR')
	);
	return results.slice(0, limit).map((entry) => entry.item);
}
