import type {
	AppItem,
	FeedSource,
	HubData,
	HubItem,
	LinkItem,
	MatchMode,
	SavedFilter
} from './types';

export interface LinkInput {
	name: string;
	description?: string;
	url: string;
	categoryId: string;
	groupId?: string;
	tags?: string[];
	pinned?: boolean;
	icon?: string;
}

export interface AppInput {
	name: string;
	description?: string;
	launchValue: string;
	categoryId: string;
	groupId?: string;
	tags?: string[];
	pinned?: boolean;
	icon?: string;
}

export interface ItemPatch {
	name?: string;
	description?: string | null;
	url?: string;
	launchValue?: string;
	categoryId?: string;
	groupId?: string | null;
	tags?: string[];
	pinned?: boolean;
	icon?: string | null;
}

export interface SourceInput {
	type: FeedSource['type'];
	name: string;
	target: string;
	categoryId: string;
	groupId?: string;
	intervalMinutes: number;
	maxItems?: number;
	locale?: string;
	enabled: boolean;
	include: string[];
	exclude: string[];
	matchMode: MatchMode;
}

export type SourcePatch = Partial<Omit<SourceInput, 'type' | 'groupId' | 'maxItems' | 'locale'>> & {
	type?: FeedSource['type'];
	groupId?: string | null;
	maxItems?: number | null;
	locale?: string | null;
};

export interface CategoryInput {
	name: string;
	color: string;
}

export interface GroupInput {
	name: string;
	categoryId: string;
}

export interface SettingsInput {
	accent?: string;
}

export type SavedFilterInput = Omit<SavedFilter, 'id'>;

function slugify(value: string): string {
	const slug = value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return slug || 'item';
}

function uniqueId(base: string, existing: Set<string>): string {
	if (!existing.has(base)) return base;
	let suffix = 2;
	while (existing.has(`${base}-${suffix}`)) suffix += 1;
	return `${base}-${suffix}`;
}

function nextItemOrder(hub: HubData, categoryId: string, groupId?: string): number {
	const siblings = hub.items.filter(
		(item) => item.categoryId === categoryId && item.groupId === groupId
	);
	return siblings.reduce((max, item) => Math.max(max, item.order), 0) + 1;
}

function itemBase(input: {
	name: string;
	description?: string;
	categoryId: string;
	groupId?: string;
	tags?: string[];
	pinned?: boolean;
	icon?: string;
}): Omit<LinkItem, 'type' | 'url'> {
	return {
		id: '',
		name: input.name,
		...(input.description ? { description: input.description } : {}),
		categoryId: input.categoryId,
		...(input.groupId ? { groupId: input.groupId } : {}),
		...(input.icon ? { icon: input.icon } : {}),
		tags: input.tags ?? [],
		pinned: input.pinned ?? false,
		order: 0
	};
}

export function addLink(hub: HubData, input: LinkInput): HubData {
	const id = uniqueId(slugify(input.name), new Set(hub.items.map((item) => item.id)));
	const item: LinkItem = {
		...itemBase(input),
		id,
		type: 'link',
		url: input.url,
		order: nextItemOrder(hub, input.categoryId, input.groupId)
	};
	return { ...hub, items: [...hub.items, item] };
}

export function addApp(hub: HubData, input: AppInput): HubData {
	const id = uniqueId(slugify(input.name), new Set(hub.items.map((item) => item.id)));
	const item: AppItem = {
		...itemBase(input),
		id,
		type: 'app',
		launch: { kind: 'protocol', value: input.launchValue },
		order: nextItemOrder(hub, input.categoryId, input.groupId)
	};
	return { ...hub, items: [...hub.items, item] };
}

export function updateItem(hub: HubData, id: string, patch: ItemPatch): HubData {
	return {
		...hub,
		items: hub.items.map((item) => {
			if (item.id !== id) return item;

			const next = { ...item } as HubItem;
			if (patch.name !== undefined) next.name = patch.name;
			if (patch.categoryId !== undefined) next.categoryId = patch.categoryId;
			if (patch.tags !== undefined) next.tags = patch.tags;
			if (patch.pinned !== undefined) next.pinned = patch.pinned;

			if (patch.description === null || patch.description === '') {
				delete (next as { description?: string }).description;
			} else if (patch.description !== undefined) {
				next.description = patch.description;
			}

			if (patch.icon === null || patch.icon === '') {
				delete (next as { icon?: string }).icon;
			} else if (patch.icon !== undefined) {
				next.icon = patch.icon;
			}

			if (patch.groupId === null) {
				delete (next as { groupId?: string }).groupId;
			} else if (patch.groupId !== undefined) {
				next.groupId = patch.groupId;
			}

			if (next.type === 'link' && patch.url !== undefined) {
				next.url = patch.url;
			}
			if (next.type === 'app' && patch.launchValue !== undefined) {
				next.launch = { kind: 'protocol', value: patch.launchValue };
			}

			return next;
		})
	};
}

export function removeItem(hub: HubData, id: string): HubData {
	return { ...hub, items: hub.items.filter((item) => item.id !== id) };
}

export function moveItem(hub: HubData, id: string, direction: 'up' | 'down'): HubData {
	const target = hub.items.find((item) => item.id === id);
	if (!target) return hub;

	const siblings = hub.items
		.filter((item) => item.categoryId === target.categoryId && item.groupId === target.groupId)
		.sort((a, b) => a.order - b.order);

	const index = siblings.findIndex((item) => item.id === id);
	const swapWith = direction === 'up' ? index - 1 : index + 1;
	if (swapWith < 0 || swapWith >= siblings.length) return hub;

	const other = siblings[swapWith];
	const orderById = new Map([
		[target.id, other.order],
		[other.id, target.order]
	]);

	return {
		...hub,
		items: hub.items.map((item) =>
			orderById.has(item.id) ? { ...item, order: orderById.get(item.id)! } : item
		)
	};
}

export function addSource(hub: HubData, input: SourceInput): HubData {
	const id = uniqueId(slugify(input.name), new Set(hub.feedSources.map((source) => source.id)));
	const source: FeedSource = {
		id,
		type: input.type,
		name: input.name,
		target: input.target,
		categoryId: input.categoryId,
		...(input.groupId ? { groupId: input.groupId } : {}),
		intervalMinutes: input.intervalMinutes,
		...(input.maxItems ? { maxItems: input.maxItems } : {}),
		...(input.locale ? { locale: input.locale } : {}),
		enabled: input.enabled,
		include: input.include,
		exclude: input.exclude,
		matchMode: input.matchMode
	};
	return { ...hub, feedSources: [...hub.feedSources, source] };
}

export function updateSource(hub: HubData, id: string, patch: SourcePatch): HubData {
	return {
		...hub,
		feedSources: hub.feedSources.map((source) => {
			if (source.id !== id) return source;

			const next: FeedSource = {
				...source,
				type: patch.type ?? source.type,
				name: patch.name ?? source.name,
				target: patch.target ?? source.target,
				categoryId: patch.categoryId ?? source.categoryId,
				intervalMinutes: patch.intervalMinutes ?? source.intervalMinutes,
				enabled: patch.enabled ?? source.enabled,
				include: patch.include ?? source.include,
				exclude: patch.exclude ?? source.exclude,
				matchMode: patch.matchMode ?? source.matchMode
			};

			if (patch.groupId === null) {
				delete next.groupId;
			} else if (patch.groupId !== undefined) {
				next.groupId = patch.groupId;
			}

			if (patch.maxItems === null) {
				delete next.maxItems;
			} else if (patch.maxItems !== undefined) {
				next.maxItems = patch.maxItems;
			}

			if (patch.locale === null) {
				delete next.locale;
			} else if (patch.locale !== undefined) {
				next.locale = patch.locale;
			}

			return next;
		})
	};
}

export function removeSource(hub: HubData, id: string): HubData {
	return {
		...hub,
		feedSources: hub.feedSources.filter((source) => source.id !== id),
		savedFilters: hub.savedFilters.map((filter) =>
			filter.sourceId === id ? { ...filter, sourceId: undefined } : filter
		)
	};
}

export function toggleSource(hub: HubData, id: string): HubData {
	return {
		...hub,
		feedSources: hub.feedSources.map((source) =>
			source.id === id ? { ...source, enabled: !source.enabled } : source
		)
	};
}

export function updateSettings(hub: HubData, patch: SettingsInput): HubData {
	return {
		...hub,
		settings: {
			...hub.settings,
			...(patch.accent ? { accent: patch.accent } : {})
		}
	};
}

export function addCategory(hub: HubData, input: CategoryInput): HubData {
	const id = uniqueId(slugify(input.name), new Set(hub.categories.map((category) => category.id)));
	const order = hub.categories.reduce((max, category) => Math.max(max, category.order), 0) + 1;
	return {
		...hub,
		categories: [...hub.categories, { id, name: input.name, color: input.color, order }]
	};
}

export function addGroup(hub: HubData, input: GroupInput): HubData {
	const id = uniqueId(slugify(input.name), new Set(hub.groups.map((group) => group.id)));
	const order =
		hub.groups
			.filter((group) => group.categoryId === input.categoryId)
			.reduce((max, group) => Math.max(max, group.order), 0) + 1;
	return {
		...hub,
		groups: [...hub.groups, { id, name: input.name, categoryId: input.categoryId, order }]
	};
}

export function updateGroup(hub: HubData, id: string, patch: Partial<GroupInput>): HubData {
	const current = hub.groups.find((group) => group.id === id);
	if (!current) return hub;

	const categoryId = patch.categoryId ?? current.categoryId;
	const categoryChanged = categoryId !== current.categoryId;
	const order = categoryChanged
		? hub.groups
				.filter((group) => group.categoryId === categoryId)
				.reduce((max, group) => Math.max(max, group.order), 0) + 1
		: current.order;

	return {
		...hub,
		groups: hub.groups.map((group) =>
			group.id === id ? { ...group, name: patch.name ?? group.name, categoryId, order } : group
		),
		items: categoryChanged
			? hub.items.map((item) => (item.groupId === id ? { ...item, categoryId } : item))
			: hub.items,
		feedSources: categoryChanged
			? hub.feedSources.map((source) =>
					source.groupId === id ? { ...source, categoryId } : source
				)
			: hub.feedSources
	};
}

export function removeGroup(hub: HubData, id: string): HubData {
	if (
		hub.items.some((item) => item.groupId === id) ||
		hub.feedSources.some((source) => source.groupId === id)
	) {
		throw new Error('Grupo em uso: mova ou remova os itens e fontes antes.');
	}
	return { ...hub, groups: hub.groups.filter((group) => group.id !== id) };
}

export function moveGroup(hub: HubData, id: string, direction: 'up' | 'down'): HubData {
	const target = hub.groups.find((group) => group.id === id);
	if (!target) return hub;

	const siblings = hub.groups
		.filter((group) => group.categoryId === target.categoryId)
		.sort((a, b) => a.order - b.order);
	const index = siblings.findIndex((group) => group.id === id);
	const swapWith = direction === 'up' ? index - 1 : index + 1;
	if (swapWith < 0 || swapWith >= siblings.length) return hub;

	const other = siblings[swapWith];
	const orderById = new Map([
		[target.id, other.order],
		[other.id, target.order]
	]);

	return {
		...hub,
		groups: hub.groups.map((group) =>
			orderById.has(group.id) ? { ...group, order: orderById.get(group.id)! } : group
		)
	};
}

export function removeCategory(hub: HubData, id: string): HubData {
	const inUse =
		hub.groups.some((group) => group.categoryId === id) ||
		hub.items.some((item) => item.categoryId === id) ||
		hub.feedSources.some((source) => source.categoryId === id);

	if (inUse) {
		throw new Error('Categoria em uso: remova ou mova os grupos, itens e fontes antes.');
	}

	return {
		...hub,
		categories: hub.categories.filter((category) => category.id !== id),
		savedFilters: hub.savedFilters.map((filter) =>
			filter.categoryId === id ? { ...filter, categoryId: undefined } : filter
		)
	};
}

export function updateCategory(hub: HubData, id: string, patch: Partial<CategoryInput>): HubData {
	return {
		...hub,
		categories: hub.categories.map((category) =>
			category.id === id
				? {
						...category,
						name: patch.name ?? category.name,
						color: patch.color ?? category.color
					}
				: category
		)
	};
}

export function moveCategory(hub: HubData, id: string, direction: 'up' | 'down'): HubData {
	const sorted = [...hub.categories].sort((a, b) => a.order - b.order);
	const index = sorted.findIndex((category) => category.id === id);
	const swapWith = direction === 'up' ? index - 1 : index + 1;

	if (index < 0 || swapWith < 0 || swapWith >= sorted.length) return hub;

	const current = sorted[index];
	const other = sorted[swapWith];
	const orderById = new Map([
		[current.id, other.order],
		[other.id, current.order]
	]);

	return {
		...hub,
		categories: hub.categories.map((category) =>
			orderById.has(category.id) ? { ...category, order: orderById.get(category.id)! } : category
		)
	};
}

export function addSavedFilter(hub: HubData, input: SavedFilterInput): HubData {
	const base = input.label || input.include[0] || input.exclude[0] || 'filtro';
	const id = uniqueId(slugify(base), new Set(hub.savedFilters.map((filter) => filter.id)));
	return {
		...hub,
		savedFilters: [
			...hub.savedFilters,
			{
				id,
				label: input.label,
				include: input.include,
				exclude: input.exclude,
				matchMode: input.matchMode,
				...(input.categoryId ? { categoryId: input.categoryId } : {}),
				...(input.sourceId ? { sourceId: input.sourceId } : {}),
				...(input.unreadOnly ? { unreadOnly: true } : {})
			}
		]
	};
}

export function removeSavedFilter(hub: HubData, id: string): HubData {
	return { ...hub, savedFilters: hub.savedFilters.filter((filter) => filter.id !== id) };
}

export function updateSavedFilter(
	hub: HubData,
	id: string,
	patch: Partial<SavedFilterInput>
): HubData {
	return {
		...hub,
		savedFilters: hub.savedFilters.map((filter) => {
			if (filter.id !== id) return filter;

			const categoryId =
				patch.categoryId === null
					? undefined
					: (patch.categoryId ?? filter.categoryId ?? undefined);
			const sourceId =
				patch.sourceId === null ? undefined : (patch.sourceId ?? filter.sourceId ?? undefined);
			const unreadOnly = patch.unreadOnly ?? filter.unreadOnly;

			return {
				id: filter.id,
				label: patch.label ?? filter.label,
				include: patch.include ?? filter.include,
				exclude: patch.exclude ?? filter.exclude,
				matchMode: patch.matchMode ?? filter.matchMode,
				...(categoryId ? { categoryId } : {}),
				...(sourceId ? { sourceId } : {}),
				...(unreadOnly ? { unreadOnly: true } : {})
			};
		})
	};
}
