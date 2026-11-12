import { HIGHLIGHT_COLOR_LABELS } from '../reader/highlights';
import type {
	ArchiveIndex,
	FeedCache,
	HighlightsData,
	HubData,
	HubState,
	ReadingHighlight
} from '../types';

export interface MarkdownExportInput {
	hub: HubData;
	state: HubState;
	feed: FeedCache;
	highlights: HighlightsData;
	archives: ArchiveIndex;
	baseUrl: string;
	now: Date;
}

export interface MarkdownFile {
	name: string;
	content: string;
}

export interface MarkdownExport {
	files: MarkdownFile[];
	index: string;
}

interface ResolvedItem {
	id: string;
	title: string;
	url: string;
	sourceName: string;
	categoryName: string;
	summary: string;
	publishedAt: string;
	savedAt: string;
	saved: boolean;
	archived: boolean;
	highlights: ReadingHighlight[];
}

function slugify(value: string): string {
	return value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60);
}

function yamlString(value: string): string {
	return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\s+/g, ' ').trim()}"`;
}

function tagsOf(names: string[]): string[] {
	return [...new Set(names.map(slugify).filter(Boolean))];
}

function dateOnly(iso: string): string {
	return iso ? iso.slice(0, 10) : '';
}

function resolveItem(id: string, input: MarkdownExportInput): ResolvedItem {
	const snapshot = input.state.savedItems[id];
	const live = input.feed.items.find((item) => item.id === id);
	const firstHighlight = input.highlights.highlights.find((highlight) => highlight.itemId === id);

	const title =
		snapshot?.item.title || live?.title || firstHighlight?.itemTitle || 'Conteúdo indisponível';
	const url = snapshot?.item.url || live?.url || firstHighlight?.itemUrl || '';
	const sourceId = snapshot?.sourceId ?? live?.sourceId;
	const source = input.hub.feedSources.find((entry) => entry.id === sourceId);
	const category = input.hub.categories.find((entry) => entry.id === source?.categoryId);

	const saved = input.state.saved.includes(id);

	return {
		id,
		title,
		url,
		sourceName: snapshot?.sourceName || source?.name || '',
		categoryName: snapshot?.categoryName || category?.name || '',
		summary: snapshot?.item.summary || live?.summary || '',
		publishedAt: snapshot?.item.publishedAt || live?.publishedAt || '',
		savedAt: saved ? (snapshot?.savedAt ?? '') : '',
		saved,
		archived: input.archives.entries[id]?.status === 'ready',
		highlights: input.highlights.highlights.filter((highlight) => highlight.itemId === id)
	};
}

function renderFile(item: ResolvedItem, input: MarkdownExportInput): MarkdownFile {
	const base = input.baseUrl.replace(/\/+$/, '');
	const tags = tagsOf([item.categoryName, item.sourceName]);
	const lines = ['---', `title: ${yamlString(item.title)}`, `url: ${yamlString(item.url)}`];

	if (item.sourceName) lines.push(`source: ${yamlString(item.sourceName)}`);
	if (item.categoryName) lines.push(`category: ${yamlString(item.categoryName)}`);
	lines.push(`saved: ${item.saved}`);
	if (item.publishedAt) lines.push(`publishedAt: ${yamlString(item.publishedAt)}`);
	if (item.savedAt) lines.push(`savedAt: ${yamlString(item.savedAt)}`);
	lines.push(`archived: ${item.archived}`);

	if (tags.length) {
		lines.push('tags:', ...tags.map((tag) => `  - ${yamlString(tag)}`));
	} else {
		lines.push('tags: []');
	}

	lines.push('---', '', `# ${item.title}`, '');

	if (item.summary) {
		lines.push(`> ${item.summary.replace(/\s+/g, ' ').trim()}`, '');
	}

	const links = [`[Ler no hub](${base}/ler/${item.id})`];
	if (item.url) links.push(`[Abrir original](${item.url})`);
	if (item.archived) links.push(`[Versão arquivada](${base}/arquivo/${item.id})`);
	lines.push(links.join(' · '), '');

	if (item.highlights.length > 0) {
		lines.push('## Destaques', '');

		for (const highlight of item.highlights) {
			const label = HIGHLIGHT_COLOR_LABELS[highlight.color] ?? highlight.color;
			const date = dateOnly(highlight.createdAt || highlight.updatedAt);
			lines.push(`### ${label}${date ? ` · ${date}` : ''}`, '');
			lines.push(`> ${highlight.quote.replace(/\s+/g, ' ').trim()}`);
			if (highlight.note) {
				lines.push('', highlight.note.replace(/\s+/g, ' ').trim());
			}
			lines.push('');
		}
	}

	return {
		name: `${slugify(item.title) || 'post'}-${item.id}.md`,
		content: `${lines.join('\n').trimEnd()}\n`
	};
}

export function buildMarkdownExport(input: MarkdownExportInput): MarkdownExport {
	const ids: string[] = [];
	for (const id of input.state.saved) if (!ids.includes(id)) ids.push(id);
	for (const highlight of input.highlights.highlights) {
		if (!ids.includes(highlight.itemId)) ids.push(highlight.itemId);
	}

	const items = ids.map((id) => resolveItem(id, input));
	const files = items.map((item) => renderFile(item, input));
	const generated = input.now.toISOString().slice(0, 10);

	const header = `# Export do Meu Hub\n\nGerado em ${generated} · ${files.length} ${
		files.length === 1 ? 'arquivo' : 'arquivos'
	}\n`;

	if (files.length === 0) {
		return { files, index: `${header}\nNenhum item salvo ou destacado.\n` };
	}

	const list = items
		.map((item, index) => {
			const file = files[index];
			const marks = item.highlights.length
				? ` · ${item.highlights.length} ${item.highlights.length === 1 ? 'destaque' : 'destaques'}`
				: '';
			const source = item.sourceName ? ` — ${item.sourceName}` : '';
			return `- [${item.title}](${file.name})${source}${marks}`;
		})
		.join('\n');

	return { files, index: `${header}\n${list}\n` };
}
