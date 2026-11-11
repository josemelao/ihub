import { error } from '@sveltejs/kit';
import { sortFeedSources } from '#lib/feed/order';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { hub } = await parent();
	const category = hub.categories.find((cat) => cat.id === params.slug);

	if (!category) {
		error(404, `Categoria '${params.slug}' não encontrada no hub.json`);
	}

	const groups = hub.groups
		.filter((group) => group.categoryId === category.id)
		.sort((a, b) => a.order - b.order);

	const items = hub.items
		.filter((item) => item.categoryId === category.id)
		.sort((a, b) => a.order - b.order);

	const ungrouped = items.filter(
		(item) => !item.groupId || !groups.some((g) => g.id === item.groupId)
	);
	if (ungrouped.length > 0) {
		groups.push({
			id: `${category.id}-sem-grupo`,
			categoryId: category.id,
			name: 'Sem grupo',
			order: 999
		});
	}

	const sources = sortFeedSources(
		hub.feedSources.filter((source) => source.categoryId === category.id)
	);

	return { category, groups, items, sources, ungroupedIds: ungrouped.map((item) => item.id) };
};
