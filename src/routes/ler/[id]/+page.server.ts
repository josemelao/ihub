import { error } from '@sveltejs/kit';
import { resolveReaderItem } from '#lib/reader/resolve';
import { getStorage } from '#lib/storage';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { hub, feed, state, highlights } = await parent();
	const article = await getStorage()
		.loadArticle(params.id)
		.catch(() => null);

	const item = feed.items.find((entry) => entry.id === params.id);
	const snapshot = state.savedItems?.[params.id];
	const info = resolveReaderItem(item, snapshot, article);
	if (!info) throw error(404, 'Post não encontrado.');

	return {
		item: info,
		source: hub.feedSources.find((entry) => entry.id === info.sourceId) ?? null,
		article,
		highlights: highlights.highlights.filter((highlight) => highlight.itemId === params.id),
		saved: state.saved.includes(params.id)
	};
};
