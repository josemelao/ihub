import { z } from 'zod';
import type { FeedCache, HubData, HubState, ValidationIssue } from './types';

export class HubValidationError extends Error {
	readonly issues: ValidationIssue[];

	constructor(issues: ValidationIssue[], label = 'hub.json') {
		super(`${label} inválido: ${issues.length} problema(s) encontrado(s)`);
		this.name = 'HubValidationError';
		this.issues = issues;
	}
}

const colorSchema = z
	.string()
	.regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/, 'Cor deve estar no formato hexadecimal (#RRGGBB)');

const urlSchema = z.string().refine(
	(value) => {
		try {
			const url = new URL(value);
			return url.protocol === 'http:' || url.protocol === 'https:';
		} catch {
			return false;
		}
	},
	{ message: 'URL inválida (use http:// ou https://)' }
);

const iconSchema = z
	.string()
	.trim()
	.refine(
		(value) => {
			if (/^https?:\/\//i.test(value)) {
				try {
					new URL(value);
					return true;
				} catch {
					return false;
				}
			}
			return /^[a-z0-9][a-z0-9-]*$/i.test(value);
		},
		{ message: 'Ícone inválido: use uma URL http(s) ou um slug do Simple Icons' }
	);

const matchModeSchema = z.enum(['any', 'all']).default('any');

const localeSchema = z
	.string()
	.regex(/^[a-z]{2}(?:[-_][A-Za-z]{2,8})*$/, 'Locale inválido (ex.: en, pt-BR)');

const categorySchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	color: colorSchema,
	order: z.number().int().default(0)
});

const groupSchema = z.object({
	id: z.string().min(1),
	categoryId: z.string().min(1),
	name: z.string().min(1),
	order: z.number().int().default(0)
});

const itemBase = {
	id: z.string().min(1),
	name: z.string().min(1),
	description: z.string().trim().max(280).optional(),
	categoryId: z.string().min(1),
	groupId: z.string().optional(),
	tags: z.array(z.string()).default([]),
	pinned: z.boolean().default(false),
	order: z.number().int().default(0),
	icon: iconSchema.optional()
};

const linkItemSchema = z.object({
	...itemBase,
	type: z.literal('link'),
	url: urlSchema
});

const appItemSchema = z.object({
	...itemBase,
	type: z.literal('app'),
	launch: z.object({
		kind: z.enum(['protocol', 'command']),
		value: z
			.string()
			.min(1)
			.refine(
				(value) => {
					const match = /^([a-z][a-z0-9+.-]*):/i.exec(value);
					if (!match) return false;
					return !['javascript', 'data', 'vbscript', 'file'].includes(match[1].toLowerCase());
				},
				{ message: 'Protocolo inválido: use um esquema seguro (ex.: steam://, discord://)' }
			)
	})
});

const itemSchema = z.discriminatedUnion('type', [linkItemSchema, appItemSchema]);

const feedSourceSchema = z.object({
	id: z.string().min(1),
	type: z.enum(['rss', 'youtube', 'reddit']),
	name: z.string().min(1),
	target: z.string().min(1),
	categoryId: z.string().min(1),
	groupId: z.string().optional(),
	intervalMinutes: z.number().int().min(1).default(30),
	maxItems: z.number().int().min(1).max(200).optional(),
	locale: localeSchema.optional(),
	enabled: z.boolean().default(true),
	include: z.array(z.string()).default([]),
	exclude: z.array(z.string()).default([]),
	matchMode: matchModeSchema
});

const savedFilterSchema = z.object({
	id: z.string().min(1),
	label: z.string().min(1),
	include: z.array(z.string()).default([]),
	exclude: z.array(z.string()).default([]),
	matchMode: matchModeSchema,
	categoryId: z.string().min(1).nullable().optional(),
	sourceId: z.string().min(1).nullable().optional(),
	unreadOnly: z.boolean().optional()
});

function addIssue(ctx: z.RefinementCtx, path: (string | number)[], message: string): void {
	ctx.addIssue({ code: 'custom', path, message });
}

function checkReferences(
	ctx: z.RefinementCtx,
	entries: { id: string; categoryId?: string; groupId?: string }[],
	collection: string,
	categoryIds: Set<string>,
	groupCategories: Map<string, string>
): void {
	entries.forEach((entry, index) => {
		if (entry.categoryId !== undefined && !categoryIds.has(entry.categoryId)) {
			addIssue(
				ctx,
				[collection, index, 'categoryId'],
				`Referência quebrada: categoria '${entry.categoryId}' não existe`
			);
		}
		if (entry.groupId !== undefined) {
			const groupCategory = groupCategories.get(entry.groupId);
			if (groupCategory === undefined) {
				addIssue(
					ctx,
					[collection, index, 'groupId'],
					`Referência quebrada: grupo '${entry.groupId}' não existe`
				);
			} else if (entry.categoryId !== undefined && groupCategory !== entry.categoryId) {
				addIssue(
					ctx,
					[collection, index, 'groupId'],
					`Referência inconsistente: o grupo '${entry.groupId}' pertence à categoria '${groupCategory}', não a '${entry.categoryId}'`
				);
			}
		}
	});
}

function checkDuplicateIds(
	ctx: z.RefinementCtx,
	entries: { id: string }[],
	collection: string
): void {
	const seen = new Set<string>();
	entries.forEach((entry, index) => {
		if (seen.has(entry.id)) {
			addIssue(ctx, [collection, index, 'id'], `id duplicado em ${collection}: '${entry.id}'`);
		}
		seen.add(entry.id);
	});
}

export const hubSchema = z
	.object({
		version: z.number().int().positive().default(1),
		settings: z.object({ accent: colorSchema }).default({ accent: '#8AA4FF' }),
		categories: z.array(categorySchema).default([]),
		groups: z.array(groupSchema).default([]),
		items: z.array(itemSchema).default([]),
		feedSources: z.array(feedSourceSchema).default([]),
		savedFilters: z.array(savedFilterSchema).default([])
	})
	.superRefine((hub, ctx) => {
		const categoryIds = new Set(hub.categories.map((c) => c.id));
		const groupCategories = new Map(hub.groups.map((g) => [g.id, g.categoryId]));
		const sourceCategories = new Map(hub.feedSources.map((s) => [s.id, s.categoryId]));

		checkDuplicateIds(ctx, hub.categories, 'categories');
		checkDuplicateIds(ctx, hub.groups, 'groups');
		checkDuplicateIds(ctx, hub.items, 'items');
		checkDuplicateIds(ctx, hub.feedSources, 'feedSources');
		checkDuplicateIds(ctx, hub.savedFilters, 'savedFilters');

		checkReferences(ctx, hub.groups, 'groups', categoryIds, new Map());
		checkReferences(ctx, hub.items, 'items', categoryIds, groupCategories);
		checkReferences(ctx, hub.feedSources, 'feedSources', categoryIds, groupCategories);

		hub.savedFilters.forEach((filter, index) => {
			if (filter.categoryId && !categoryIds.has(filter.categoryId)) {
				addIssue(
					ctx,
					['savedFilters', index, 'categoryId'],
					`Referência quebrada: categoria '${filter.categoryId}' não existe`
				);
			}

			if (filter.sourceId) {
				const sourceCategory = sourceCategories.get(filter.sourceId);
				if (sourceCategory === undefined) {
					addIssue(
						ctx,
						['savedFilters', index, 'sourceId'],
						`Referência quebrada: fonte '${filter.sourceId}' não existe`
					);
				} else if (filter.categoryId && sourceCategory !== filter.categoryId) {
					addIssue(
						ctx,
						['savedFilters', index, 'sourceId'],
						`Referência inconsistente: a fonte '${filter.sourceId}' pertence à categoria '${sourceCategory}', não a '${filter.categoryId}'`
					);
				}
			}
		});
	});

const feedItemSchema = z.object({
	id: z.string().min(1),
	sourceId: z.string().min(1),
	title: z.string().min(1),
	summary: z.string().default(''),
	url: urlSchema,
	publishedAt: z.string().default(''),
	thumbnail: urlSchema.nullable().default(null)
});

const sourceStatusSchema = z.object({
	lastFetchedAt: z.string().default(''),
	error: z.string().nullable().default(null),
	count: z.number().int().nonnegative().default(0)
});

const savedSnapshotSchema = z.object({
	item: feedItemSchema,
	sourceId: z.string().min(1),
	sourceName: z.string().min(1),
	categoryId: z.string().optional(),
	categoryName: z.string().optional(),
	color: colorSchema.optional(),
	locale: localeSchema.optional(),
	savedAt: z.string().default('')
});

export const stateSchema = z
	.object({
		version: z.number().int().positive().default(1),
		read: z.record(z.string(), z.string()).default({}),
		saved: z.array(z.string()).default([]),
		savedItems: z.record(z.string(), savedSnapshotSchema).default({}),
		lastPrunedAt: z.string().optional()
	})
	.superRefine((state, ctx) => {
		for (const [key, snapshot] of Object.entries(state.savedItems)) {
			if (snapshot.item.id !== key) {
				addIssue(
					ctx,
					['savedItems', key, 'item', 'id'],
					`O snapshot '${key}' aponta para o item '${snapshot.item.id}'`
				);
			}
		}
	});

export const feedCacheSchema = z.object({
	version: z.number().int().positive().default(1),
	updatedAt: z.string().default(new Date(0).toISOString()),
	items: z.array(feedItemSchema).default([]),
	sources: z.record(z.string(), sourceStatusSchema).default({})
});

function issuesFrom(error: z.ZodError): ValidationIssue[] {
	return error.issues.map((issue) => ({
		path: issue.path as (string | number)[],
		message: issue.message
	}));
}

export function parseHub(input: unknown): HubData {
	const result = hubSchema.safeParse(input);
	if (!result.success) {
		throw new HubValidationError(issuesFrom(result.error));
	}
	return result.data as HubData;
}

export function parseHubState(input: unknown): HubState {
	const result = stateSchema.safeParse(input);
	if (!result.success) {
		throw new HubValidationError(issuesFrom(result.error), 'estado.json');
	}
	return result.data as HubState;
}

export function parseFeedCache(input: unknown): FeedCache {
	const result = feedCacheSchema.safeParse(input);
	if (!result.success) {
		throw new HubValidationError(issuesFrom(result.error), 'feed-cache.json');
	}
	return result.data as FeedCache;
}
