import type {
	AppItem,
	Category,
	FeedSource,
	HubData,
	HubItem,
	LinkItem,
	MatchMode,
	SavedFilter
} from './types';

export interface LinkInput {
	name: string;
	url: string;
	categoryId: string;
	groupId?: string;
	tags?: string[];
	pinned?: boolean;
}

export interface AppInput {
	name: string;
	launchValue: string;
	categoryId: string;
	groupId?: string;
	tags?: string[];
	pinned?: boolean;
}

export interface ItemPatch {
	name?: string;
	url?: string;
	launchValue?: string;
	categoryId?: string;
	groupId?: string | null;
	tags?: string[];
	pinned?: boolean;
}

export interface SourceInput {
	type: FeedSource['type'];
	name: string;
	target: string;
	categoryId: string;
	groupId?: string;
	intervalMinutes: number;
	enabled: boolean;
	include: string[];
	exclude: string[];
	matchMode: MatchMode;
}

export type SourcePatch = Partial<Omit<SourceInput, 'type'>> & { type?: FeedSource['type'] };

export type CategoryInput = Pick<Category, 'name' | 'color'>;
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
	categoryId: string;
	groupId?: string;
	tags?: string[];
	pinned?: boolean;
}): Omit<LinkItem, 'type' | 'url'> {
	return {
		id: '',
		name: input.name,
		categoryId: input.categoryId,
		...(input.groupId ? { groupId: input.groupId } : {}),
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
			const next: FeedSource = { ...source, ...patch };
			if (patch.groupId === null) delete next.groupId;
			return next;
		})
	};
}

export function removeSource(hub: HubData, id: string): HubData {
	return { ...hub, feedSources: hub.feedSources.filter((source) => source.id !== id) };
}

export function toggleSource(hub: HubData, id: string): HubData {
	return {
		...hub,
		feedSources: hub.feedSources.map((source) =>
			source.id === id ? { ...source, enabled: !source.enabled } : source
		)
	};
}

export function addCategory(hub: HubData, input: CategoryInput): HubData {
	const id = uniqueId(slugify(input.name), new Set(hub.categories.map((category) => category.id)));
	const order = hub.categories.reduce((max, category) => Math.max(max, category.order), 0) + 1;
	return { ...hub, categories: [...hub.categories, { id, ...input, order }] };
}

export function removeCategory(hub: HubData, id: string): HubData {
	const inUse =
		hub.groups.some((group) => group.categoryId === id) ||
		hub.items.some((item) => item.categoryId === id) ||
		hub.feedSources.some((source) => source.categoryId === id);

	if (inUse) {
		throw new Error('Categoria em uso: remova ou mova os grupos, itens e fontes antes.');
	}

	return { ...hub, categories: hub.categories.filter((category) => category.id !== id) };
}

export function addSavedFilter(hub: HubData, input: SavedFilterInput): HubData {
	const base = input.label || input.include[0] || input.exclude[0] || 'filtro';
	const id = uniqueId(slugify(base), new Set(hub.savedFilters.map((filter) => filter.id)));
	return { ...hub, savedFilters: [...hub.savedFilters, { id, ...input }] };
}

export function removeSavedFilter(hub: HubData, id: string): HubData {
	return { ...hub, savedFilters: hub.savedFilters.filter((filter) => filter.id !== id) };
}
