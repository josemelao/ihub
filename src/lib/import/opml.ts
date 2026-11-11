import { XMLParser } from 'fast-xml-parser';
import { feedUrlFor } from '../feed/sources';
import { toSafeHttpUrl } from '../net/url';
import type { FeedSource, FeedSourceType, HubData } from '../types';
import { addIssue, type ImportIssue } from './issues';

export interface ParsedOpmlSource {
	name: string;
	feedUrl: string;
	folderPath: string[];
}

export interface ParsedOpml {
	sources: ParsedOpmlSource[];
	skipped: number;
	invalid?: ImportIssue[];
}

const MAX_DEPTH = 50;

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	textNodeName: '#text',
	processEntities: true,
	trimValues: true
});

function asArray<T>(value: T | T[] | undefined | null): T[] {
	if (value === undefined || value === null) return [];
	return Array.isArray(value) ? value : [value];
}

function textOf(value: unknown): string {
	if (value === null || value === undefined) return '';
	if (typeof value === 'string' || typeof value === 'number') return String(value);
	if (typeof value === 'object') {
		const object = value as Record<string, unknown>;
		if ('#text' in object) return textOf(object['#text']);
		if ('#cdata' in object) return textOf(object['#cdata']);
	}
	return '';
}

function nameOf(node: Record<string, unknown>): string {
	return (
		textOf(node['@_title']) ||
		textOf(node['@_text']) ||
		textOf(node['@_name']) ||
		textOf(node)
	).trim();
}

function feedUrlOf(node: Record<string, unknown>): string {
	return (
		textOf(node['@_xmlUrl']) ||
		textOf(node['@_xmlurl']) ||
		textOf(node['@_url']) ||
		''
	).trim();
}

function walk(
	node: unknown,
	folderPath: string[],
	out: ParsedOpmlSource[],
	seen: Set<string>,
	counter: { skipped: number },
	invalid: ImportIssue[],
	depth: number
): void {
	if (depth > MAX_DEPTH * 4) {
		counter.skipped += 1;
		addIssue(invalid, '', 'profundidade máxima');
		return;
	}

	for (const entry of asArray(node)) {
		if (!entry || typeof entry !== 'object') continue;
		const outline = entry as Record<string, unknown>;
		const rawFeedUrl = feedUrlOf(outline);
		const feedUrl = toSafeHttpUrl(rawFeedUrl);
		const hasFeedAttribute = '@_xmlUrl' in outline || '@_xmlurl' in outline || '@_url' in outline;

		if ((rawFeedUrl || hasFeedAttribute) && !feedUrl) {
			counter.skipped += 1;
			addIssue(invalid, rawFeedUrl, 'URL não http(s)');
			continue;
		}

		if (feedUrl) {
			if (seen.has(feedUrl)) {
				counter.skipped += 1;
				addIssue(invalid, feedUrl, 'feed duplicado');
				continue;
			}
			seen.add(feedUrl);
			out.push({
				name: nameOf(outline) || feedUrl,
				feedUrl,
				folderPath: [...folderPath]
			});
			continue;
		}

		const folder = nameOf(outline);
		let nextPath = folderPath;
		if (folder) {
			if (depth < MAX_DEPTH) {
				nextPath = [...folderPath, folder];
			} else {
				counter.skipped += 1;
				addIssue(invalid, folder, 'profundidade máxima');
			}
		}
		walk(outline.outline, nextPath, out, seen, counter, invalid, depth + 1);
	}
}

/**
 * Lê OPML de qualquer ferramenta: `outline` com `xmlUrl`/`url` é um feed;
 * `outline` sem URL é uma pasta. Profundidade limitada e feeds duplicados
 * são ignorados.
 */
export function parseOpml(xml: string): ParsedOpml {
	const sources: ParsedOpmlSource[] = [];
	const invalid: ImportIssue[] = [];
	const counter = { skipped: 0 };

	try {
		const parsed = parser.parse(xml) as { opml?: { body?: { outline?: unknown } } };
		if (!parsed.opml) {
			addIssue(invalid, '', 'XML inválido ou sem <opml>');
			return { sources: [], skipped: 1, invalid };
		}
		walk(parsed.opml.body?.outline, [], sources, new Set<string>(), counter, invalid, 0);
	} catch {
		addIssue(invalid, '', 'XML inválido ou sem <opml>');
		return { sources: [], skipped: 1, invalid };
	}

	return { sources, skipped: counter.skipped, invalid };
}

export function inferSourceType(feedUrl: string): FeedSourceType {
	const safe = toSafeHttpUrl(feedUrl);
	if (!safe) return 'rss';

	const url = new URL(safe);
	const host = url.hostname.toLowerCase();

	if (
		(host === 'youtube.com' || host.endsWith('.youtube.com')) &&
		url.pathname === '/feeds/videos.xml'
	) {
		return 'youtube';
	}

	if ((host === 'reddit.com' || host.endsWith('.reddit.com')) && /^\/r\/[^/]+/.test(url.pathname)) {
		return 'reddit';
	}

	return 'rss';
}

function escapeXml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => {
		switch (character) {
			case '&':
				return '&amp;';
			case '<':
				return '&lt;';
			case '>':
				return '&gt;';
			case '"':
				return '&quot;';
			default:
				return '&apos;';
		}
	});
}

function sourceOutline(source: FeedSource): string | null {
	let feedUrl: string | null;
	try {
		feedUrl = feedUrlFor(source);
	} catch {
		feedUrl = source.type === 'rss' ? source.target : null;
	}
	// Só http(s) pode sair no XML exportado.
	const safeFeedUrl = feedUrl ? toSafeHttpUrl(feedUrl) : null;
	if (!safeFeedUrl) return null;

	return `        <outline type="rss" text="${escapeXml(source.name)}" xmlUrl="${escapeXml(safeFeedUrl)}"/>`;
}

/**
 * Exporta as fontes do hub em OPML agrupadas por categoria e grupo.
 * Fontes cujo feed não pode ser resolvido (ex.: handle do YouTube) são omitidas.
 */
export function buildOpml(hub: HubData): string {
	const lines = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<opml version="2.0">',
		'  <head>',
		'    <title>Meu Hub - fontes</title>',
		'  </head>',
		'  <body>'
	];

	const categories = [...hub.categories].sort((a, b) => a.order - b.order);

	for (const category of categories) {
		const groups = hub.groups
			.filter((group) => group.categoryId === category.id)
			.sort((a, b) => a.order - b.order);
		const categorySources = hub.feedSources.filter(
			(source) => source.categoryId === category.id && !source.groupId
		);
		const groupBlocks = groups
			.map((group) => {
				const groupSources = hub.feedSources.filter((source) => source.groupId === group.id);
				const outlines = groupSources
					.map(sourceOutline)
					.filter((line): line is string => line !== null);
				if (outlines.length === 0) return null;
				return [
					`      <outline text="${escapeXml(group.name)}">`,
					...outlines,
					'      </outline>'
				].join('\n');
			})
			.filter((block): block is string => block !== null);
		const directOutlines = categorySources
			.map(sourceOutline)
			.filter((line): line is string => line !== null);

		if (groupBlocks.length === 0 && directOutlines.length === 0) continue;

		lines.push(`    <outline text="${escapeXml(category.name)}">`);
		lines.push(...directOutlines);
		if (groupBlocks.length > 0) lines.push(...groupBlocks);
		lines.push('    </outline>');
	}

	lines.push('  </body>', '</opml>');
	return `${lines.join('\n')}\n`;
}
