import { error } from '@sveltejs/kit';
import { sortFeedSources } from '#lib/feed/order';
import { buildFeedView } from '#lib/feed/view';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { hub, feed, state } = await parent();

	const group = hub.groups.find((entry) => entry.id === params.slug);
	if (!group) {
		error(404, `Grupo '${params.slug}' não encontrado no hub.json`);
	}

	const category = hub.categories.find((entry) => entry.id === group.categoryId);
	if (!category) {
		error(404, `Categoria do grupo '${group.name}' não encontrada no hub.json`);
	}

	const items = hub.items
		.filter((item) => item.groupId === group.id)
		.sort((a, b) => a.order - b.order);

	const sources = sortFeedSources(hub.feedSources.filter((source) => source.groupId === group.id));
	const sourceIds = new Set(sources.map((source) => source.id));
	const entries = buildFeedView(hub, feed, state).filter((entry) => sourceIds.has(entry.source.id));

	return { group, category, items, sources, entries };
};
