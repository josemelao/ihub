import { groupHighlights } from '#lib/reader/highlights-view';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { highlights } = await parent();

	return { groups: groupHighlights(highlights.highlights) };
};
