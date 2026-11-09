import { z } from 'zod';
import type { HubData, ValidationIssue } from './types';

export class HubValidationError extends Error {
	readonly issues: ValidationIssue[];

	constructor(issues: ValidationIssue[]) {
		super(`hub.json inválido: ${issues.length} problema(s) encontrado(s)`);
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

const matchModeSchema = z.enum(['any', 'all']).default('any');

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
	categoryId: z.string().min(1),
	groupId: z.string().optional(),
	tags: z.array(z.string()).default([]),
	pinned: z.boolean().default(false),
	order: z.number().int().default(0)
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
		value: z.string().min(1)
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
	matchMode: matchModeSchema
});

function addIssue(
	ctx: z.RefinementCtx,
	path: (string | number)[],
	message: string
): void {
	ctx.addIssue({ code: 'custom', path, message });
}

function checkReferences(
	ctx: z.RefinementCtx,
	entries: { id: string; categoryId?: string; groupId?: string }[],
	collection: string,
	categoryIds: Set<string>,
	groupIds: Set<string>
): void {
	entries.forEach((entry, index) => {
		if (entry.categoryId !== undefined && !categoryIds.has(entry.categoryId)) {
			addIssue(
				ctx,
				[collection, index, 'categoryId'],
				`Referência quebrada: categoria '${entry.categoryId}' não existe`
			);
		}
		if (entry.groupId !== undefined && !groupIds.has(entry.groupId)) {
			addIssue(
				ctx,
				[collection, index, 'groupId'],
				`Referência quebrada: grupo '${entry.groupId}' não existe`
			);
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
		const groupIds = new Set(hub.groups.map((g) => g.id));

		checkDuplicateIds(ctx, hub.categories, 'categories');
		checkDuplicateIds(ctx, hub.groups, 'groups');
		checkDuplicateIds(ctx, hub.items, 'items');
		checkDuplicateIds(ctx, hub.feedSources, 'feedSources');
		checkDuplicateIds(ctx, hub.savedFilters, 'savedFilters');

		checkReferences(ctx, hub.groups, 'groups', categoryIds, new Set());
		checkReferences(ctx, hub.items, 'items', categoryIds, groupIds);
		checkReferences(ctx, hub.feedSources, 'feedSources', categoryIds, groupIds);
	});

export function parseHub(input: unknown): HubData {
	const result = hubSchema.safeParse(input);
	if (!result.success) {
		throw new HubValidationError(
			result.error.issues.map((issue) => ({
				path: issue.path as (string | number)[],
				message: issue.message
			}))
		);
	}
	return result.data as HubData;
}
