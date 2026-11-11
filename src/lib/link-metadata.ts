import { decodeEntities } from './feed/parse';
import { toSafeHttpUrl } from './net/url';

export interface LinkMetadata {
	name: string;
	description: string;
	icon: string | null;
}

const MAX_DESCRIPTION = 280;

function cleanText(value: string): string {
	return decodeEntities(value.replace(/<[^>]*>/g, ' '))
		.replace(/\s+/g, ' ')
		.trim();
}

function tagAttributes(tag: string): Record<string, string> {
	const attrs: Record<string, string> = {};
	const pattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
	let match: RegExpExecArray | null;

	while ((match = pattern.exec(tag))) {
		attrs[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
	}

	return attrs;
}

/**
 * Extrai título, descrição e ícone de uma página HTML.
 * Valores são texto puro; só o ícone pode apontar para fora, e apenas http(s).
 */
export function parseLinkMetadata(html: string, baseUrl: string): LinkMetadata {
	const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
	let description = '';
	let socialDescription = '';

	for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
		const attrs = tagAttributes(tag);
		const content = (attrs.content ?? '').trim();
		if (!content) continue;

		const key = (attrs.name ?? attrs.property ?? '').toLowerCase();
		if (key === 'description' && !description) description = content;
		if ((key === 'og:description' || key === 'twitter:description') && !socialDescription) {
			socialDescription = content;
		}
	}

	let icon: string | null = null;
	for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
		const attrs = tagAttributes(tag);
		const rel = (attrs.rel ?? '').toLowerCase().split(/\s+/);
		if (!rel.includes('icon') || !attrs.href) continue;

		try {
			icon = toSafeHttpUrl(new URL(attrs.href, baseUrl).toString());
		} catch {
			icon = null;
		}
		if (icon) break;
	}

	let hostname = baseUrl;
	try {
		hostname = new URL(baseUrl).hostname;
	} catch {
		// mantém a URL original como último recurso
	}

	return {
		name: cleanText(titleMatch?.[1] ?? '') || hostname,
		description: cleanText(description || socialDescription).slice(0, MAX_DESCRIPTION),
		icon
	};
}
