import { json } from '@sveltejs/kit';
import { getSavedContentIndex } from '#lib/reader/content-index';
import { searchContent } from '#lib/reader/content-search';
import { getStorage } from '#lib/storage';
import type { RequestHandler } from './$types';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export const GET: RequestHandler = async ({ url }) => {
	const query = (url.searchParams.get('q') ?? '').trim();
	if (query.length < 2) {
		return json({ error: 'Digite ao menos 2 caracteres.' }, { status: 400 });
	}

	const requested = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT);
	const limit = Number.isFinite(requested)
		? Math.min(Math.max(Math.trunc(requested), 1), MAX_LIMIT)
		: DEFAULT_LIMIT;
	const sort = url.searchParams.get('sort') === 'published' ? 'published' : 'saved';

	try {
		const storage = getStorage();
		const [index, highlights] = await Promise.all([
			getSavedContentIndex(storage),
			storage.loadHighlights()
		]);

		return json(
			searchContent({
				docs: index.docs,
				highlights: highlights.highlights,
				query,
				limit,
				sort,
				coverage: { saved: index.savedCount, savedWithText: index.savedWithText }
			})
		);
	} catch {
		return json({ error: 'Falha ao buscar no conteúdo dos salvos.' }, { status: 500 });
	}
};
