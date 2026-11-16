import { getSavedContentIndex } from '#lib/reader/content-index';
import { buildReadingStats } from '#lib/reader/stats';
import { getStorage } from '#lib/storage';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const [{ state, highlights }, index, archive] = await Promise.all([
		parent(),
		getSavedContentIndex(),
		getStorage().loadArchiveIndex()
	]);

	return { stats: buildReadingStats({ index, state, highlights, archive }) };
};
