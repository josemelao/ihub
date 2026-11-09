import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import type { FeedItem } from '../types';

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	textNodeName: '#text',
	processEntities: true,
	trimValues: true
});

function textOf(value: unknown): string {
	if (value === null || value === undefined) return '';
	if (typeof value === 'string' || typeof value === 'number') return String(value);
	if (typeof value === 'object') {
		const object = value as Record<string, unknown>;
		if ('#cdata' in object) return textOf(object['#cdata']);
		if ('#text' in object) return textOf(object['#text']);
		if ('@_href' in object) return textOf(object['@_href']);
	}
	return '';
}

function asArray<T>(value: T | T[] | undefined): T[] {
	if (value === undefined || value === null) return [];
	return Array.isArray(value) ? value : [value];
}

function stripTags(value: string): string {
	return value
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<[^>]*>/g, ' ')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&quot;/gi, '"')
		.replace(/&#0?39;/gi, "'")
		.replace(/\s+/g, ' ')
		.replace(/\s+([.,!?;:])/g, '$1')
		.trim();
}

function linkOf(value: unknown): string {
	if (typeof value === 'string') return value.trim();
	if (Array.isArray(value)) {
		for (const entry of value) {
			const link = linkOf(entry);
			if (link) return link;
		}
		return '';
	}
	if (value && typeof value === 'object') {
		const object = value as Record<string, unknown>;
		if (typeof object['@_href'] === 'string') return object['@_href'].trim();
		return textOf(object['#text']).trim();
	}
	return '';
}

function thumbnailOf(item: Record<string, unknown>): string | null {
	const enclosure = item.enclosure;
	const media = item['media:content'] ?? item['media:thumbnail'];

	for (const candidate of [enclosure, media]) {
		for (const entry of asArray(candidate)) {
			if (entry && typeof entry === 'object') {
				const url = (entry as Record<string, unknown>)['@_url'];
				if (typeof url === 'string' && url) return url;
			}
		}
	}

	return null;
}

function publishedAtOf(value: string): string {
	if (!value) return '';
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function makeId(sourceId: string, guid: string, url: string, title: string): string {
	return createHash('sha1')
		.update(`${sourceId}\u0000${guid || url || title}`)
		.digest('hex')
		.slice(0, 16);
}

export function parseFeed(xml: string, sourceId: string): FeedItem[] {
	if (!xml || !xml.trim()) return [];

	let document: unknown;
	try {
		document = parser.parse(xml);
	} catch {
		return [];
	}

	const root = document as Record<string, unknown> | null;
	if (!root || typeof root !== 'object') return [];

	const channel = root.rss as Record<string, unknown> | undefined;
	const feed = root.feed as Record<string, unknown> | undefined;
	const rawItems = asArray(
		(channel?.channel as Record<string, unknown> | undefined)?.item as
			| Record<string, unknown>
			| Record<string, unknown>[]
			| undefined
	).length
		? asArray(
				(channel?.channel as Record<string, unknown>).item as
					| Record<string, unknown>
					| Record<string, unknown>[]
			)
		: asArray(feed?.entry as Record<string, unknown> | Record<string, unknown>[] | undefined);

	const items: FeedItem[] = [];
	const seen = new Set<string>();

	for (const raw of rawItems) {
		if (!raw || typeof raw !== 'object') continue;
		const item = raw as Record<string, unknown>;

		const title = stripTags(textOf(item.title));
		const url = linkOf(item.link);
		if (!title || !url) continue;

		const summary = stripTags(
			textOf(item.description ?? item.summary ?? item.content ?? item['content:encoded'])
		).slice(0, 280);

		const guid = textOf(item.guid ?? item.id);
		const publishedAt = publishedAtOf(textOf(item.pubDate ?? item.published ?? item.updated));
		const id = makeId(sourceId, guid, url, title);

		if (seen.has(url)) continue;
		seen.add(url);

		items.push({
			id,
			sourceId,
			title,
			summary,
			url,
			publishedAt,
			thumbnail: thumbnailOf(item)
		});
	}

	return items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
