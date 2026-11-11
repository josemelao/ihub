import { buildOpml } from '#lib/import/opml';
import { getStorage } from '#lib/storage';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const { hub } = await getStorage().loadHubWithFallback();

	return new Response(buildOpml(hub), {
		headers: {
			'content-type': 'application/xml; charset=utf-8',
			'content-disposition': 'attachment; filename="ihub-feeds.opml"'
		}
	});
};
