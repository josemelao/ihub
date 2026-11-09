import { json } from '@sveltejs/kit';
import { refreshAndSave } from '#lib/feed/scheduler';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
	try {
		const outcome = await refreshAndSave(true);
		return json({
			ok: true,
			updatedAt: outcome.cache.updatedAt,
			items: outcome.cache.items.length,
			results: outcome.results
		});
	} catch (error) {
		return json(
			{ ok: false, error: error instanceof Error ? error.message : String(error) },
			{ status: 500 }
		);
	}
};
