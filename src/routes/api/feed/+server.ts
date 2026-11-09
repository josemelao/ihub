import { json } from '@sveltejs/kit';
import { getStorage } from '#lib/storage';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const cache = await getStorage().loadFeedCache();
	return json(cache);
};
