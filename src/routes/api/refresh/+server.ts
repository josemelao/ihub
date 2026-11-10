import { json } from '@sveltejs/kit';
import { refreshAndSave } from '#lib/feed/scheduler';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	let sourceId: string | undefined;

	try {
		const body: unknown = await request.json();
		if (
			typeof body === 'object' &&
			body !== null &&
			'sourceId' in body &&
			typeof body.sourceId === 'string' &&
			body.sourceId.length > 0
		) {
			sourceId = body.sourceId;
		}
	} catch {
		// corpo vazio ou inválido: atualiza todas as fontes
	}

	try {
		const outcome = await refreshAndSave(true, sourceId);
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
