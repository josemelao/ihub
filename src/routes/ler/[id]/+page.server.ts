import { error } from '@sveltejs/kit';
import { resolveReaderItem } from '#lib/reader/resolve';
import { getStorage } from '#lib/storage';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { hub, feed, state } = await parent();
	const storage = getStorage();
	const [article, highlightsData] = await Promise.all([
		storage.loadArticle(params.id).catch(() => null),
		storage.loadHighlights().catch(() => null)
	]);

	const item = feed.items.find((entry) => entry.id === params.id);
	const snapshot = state.savedItems?.[params.id];
	const info = resolveReaderItem(item, snapshot, article);
	if (!info) throw error(404, 'Post não encontrado.');

	return {
		item: info,
		source: hub.feedSources.find((entry) => entry.id === info.sourceId) ?? null,
		article,
		highlights: (highlightsData?.highlights ?? []).filter(
			(highlight) => highlight.itemId === params.id
		),
		saved: state.saved.includes(params.id)
	};
};
