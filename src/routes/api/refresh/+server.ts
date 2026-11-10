import { json } from '@sveltejs/kit';
import { refreshAndSave } from '#lib/feed/scheduler';
import { readJsonLimited, RequestBodyError } from '#lib/net/body';
import type { RequestHandler } from './$types';

const MAX_BODY_BYTES = 64_000;

export const POST: RequestHandler = async ({ request }) => {
	let sourceId: string | undefined;

	try {
		const body = (await readJsonLimited(request, MAX_BODY_BYTES)) as { sourceId?: unknown };
		if (typeof body?.sourceId === 'string' && body.sourceId.length > 0) {
			sourceId = body.sourceId;
		}
	} catch (error) {
		if (error instanceof RequestBodyError && error.status === 413) {
			return json({ ok: false, error: error.message }, { status: 413 });
		}
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
