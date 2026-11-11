import { buildBookmarksHtml } from '#lib/import/bookmarks-export';
import { getStorage } from '#lib/storage';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const { hub } = await getStorage().loadHubWithFallback();

	return new Response(buildBookmarksHtml(hub), {
		headers: {
			'content-type': 'text/html; charset=utf-8',
			'content-disposition': 'attachment; filename="ihub-bookmarks.html"'
		}
	});
};
