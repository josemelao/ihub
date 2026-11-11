import {
	addCategory,
	addGroup,
	addLinks,
	addSources,
	type LinkInput,
	type SourceInput
} from '../hub-edit';
import type { HubData } from '../types';
import type { ParsedBookmarks } from './bookmarks';
import { inferSourceType, type ParsedOpml } from './opml';

export interface FileImportOptions {
	categoryName?: string;
}

export interface FileImportSummary {
	categoriesAdded: number;
	groupsAdded: number;
	itemsAdded: number;
	sourcesAdded: number;
	duplicates: number;
	skipped: number;
	warnings: string[];
}

export interface FileImportResult {
	hub: HubData;
	summary: FileImportSummary;
}

const COLORS = ['#8AA4FF', '#7DD3A8', '#F2A65A', '#E58BC0', '#B79CFF', '#F28B82', '#6CB6FF'];

function normalize(value: string): string {
	return value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.trim()
		.toLowerCase();
}

function emptySummary(skipped: number): FileImportSummary {
	return {
		categoriesAdded: 0,
		groupsAdded: 0,
		itemsAdded: 0,
		sourcesAdded: 0,
		duplicates: 0,
		skipped,
		warnings: []
	};
}

function ensureCategory(
	hub: HubData,
	name: string,
	summary: FileImportSummary
): { hub: HubData; id: string } {
	const wanted = normalize(name);
	const existing = hub.categories.find((category) => normalize(category.name) === wanted);
	if (existing) return { hub, id: existing.id };

	const next = addCategory(hub, {
		name,
		color: COLORS[hub.categories.length % COLORS.length]
	});
	summary.categoriesAdded += 1;
	return { hub: next, id: next.categories.at(-1)!.id };
}

function ensureGroup(
	hub: HubData,
	categoryId: string,
	name: string,
	summary: FileImportSummary
): { hub: HubData; id: string | undefined } {
	if (!name) return { hub, id: undefined };

	const wanted = normalize(name);
	const existing = hub.groups.find(
		(group) => group.categoryId === categoryId && normalize(group.name) === wanted
	);
	if (existing) return { hub, id: existing.id };

	const next = addGroup(hub, { name, categoryId });
	summary.groupsAdded += 1;
	return { hub: next, id: next.groups.at(-1)!.id };
}

function bookmarkTarget(
	hub: HubData,
	folderPath: string[],
	options: FileImportOptions,
	summary: FileImportSummary
): { hub: HubData; categoryId: string; groupId?: string } {
	if (options.categoryName) {
		const category = ensureCategory(hub, options.categoryName, summary);
		const group = ensureGroup(category.hub, category.id, folderPath.join(' / '), summary);
		return { hub: group.hub, categoryId: category.id, groupId: group.id };
	}

	const category = ensureCategory(hub, folderPath[0] || 'Importados', summary);
	const group = ensureGroup(category.hub, category.id, folderPath.slice(1).join(' / '), summary);
	return { hub: group.hub, categoryId: category.id, groupId: group.id };
}

function opmlTarget(
	hub: HubData,
	folderPath: string[],
	options: FileImportOptions,
	summary: FileImportSummary
): { hub: HubData; categoryId: string; groupId?: string } {
	if (options.categoryName) {
		const category = ensureCategory(hub, options.categoryName, summary);
		const group = ensureGroup(category.hub, category.id, folderPath.join(' / '), summary);
		return { hub: group.hub, categoryId: category.id, groupId: group.id };
	}

	const category = ensureCategory(hub, folderPath[0] || 'Feeds importados', summary);
	const group = ensureGroup(category.hub, category.id, folderPath.slice(1).join(' / '), summary);
	return { hub: group.hub, categoryId: category.id, groupId: group.id };
}

function feedKey(target: string): string {
	return target.trim().replace(/\/+$/, '').toLowerCase();
}

export function applyBookmarksImport(
	hub: HubData,
	parsed: ParsedBookmarks,
	options: FileImportOptions = {}
): FileImportResult {
	const summary = emptySummary(parsed.skipped);
	const urls = new Set(
		hub.items.filter((item) => item.type === 'link').map((item) => item.url.trim().toLowerCase())
	);
	const inputs: LinkInput[] = [];
	let next = hub;

	for (const bookmark of parsed.bookmarks) {
		const key = bookmark.url.trim().toLowerCase();
		if (urls.has(key)) {
			summary.duplicates += 1;
			continue;
		}
		urls.add(key);

		const target = bookmarkTarget(next, bookmark.folderPath, options, summary);
		next = target.hub;
		inputs.push({
			name: bookmark.title,
			url: bookmark.url,
			categoryId: target.categoryId,
			groupId: target.groupId,
			tags: ['importado']
		});
	}

	summary.itemsAdded = inputs.length;
	return { hub: addLinks(next, inputs), summary };
}

export function applyOpmlImport(
	hub: HubData,
	parsed: ParsedOpml,
	options: FileImportOptions = {}
): FileImportResult {
	const summary = emptySummary(parsed.skipped);
	const feeds = new Set(hub.feedSources.map((source) => feedKey(source.target)));
	const inputs: SourceInput[] = [];
	let next = hub;

	for (const entry of parsed.sources) {
		const key = feedKey(entry.feedUrl);
		if (feeds.has(key)) {
			summary.duplicates += 1;
			continue;
		}
		feeds.add(key);

		const target = opmlTarget(next, entry.folderPath, options, summary);
		next = target.hub;
		inputs.push({
			type: inferSourceType(entry.feedUrl),
			name: entry.name,
			target: entry.feedUrl,
			categoryId: target.categoryId,
			groupId: target.groupId,
			intervalMinutes: 30,
			enabled: true,
			include: [],
			exclude: [],
			matchMode: 'any'
		});
	}

	summary.sourcesAdded = inputs.length;
	return { hub: addSources(next, inputs), summary };
}
