import { json } from '@sveltejs/kit';
import { refreshJobs } from '#lib/feed/refresh-jobs';
import { refreshAndSave } from '#lib/feed/scheduler';
import { readJsonLimited, RequestBodyError } from '#lib/net/body';
import type { RequestHandler } from './$types';

const MAX_BODY_BYTES = 64_000;

export const POST: RequestHandler = async ({ request, url }) => {
	let sourceId: string | undefined;
	let async = url.searchParams.get('async') === '1';

	try {
		const body = (await readJsonLimited(request, MAX_BODY_BYTES)) as {
			sourceId?: unknown;
			async?: unknown;
		};
		if (typeof body?.sourceId === 'string' && body.sourceId.length > 0) {
			sourceId = body.sourceId;
		}
		if (body?.async === true) async = true;
	} catch (error) {
		if (error instanceof RequestBodyError && error.status === 413) {
			return json({ ok: false, error: error.message }, { status: 413 });
		}
		// corpo vazio ou inválido: atualiza todas as fontes
	}

	// Progresso só faz sentido no refresh global; fonte única continua síncrona.
	if (async && !sourceId) {
		try {
			const job = await refreshJobs.start();
			return json({ ok: true, jobId: job.id, total: job.total }, { status: 202 });
		} catch (error) {
			return json(
				{ ok: false, error: error instanceof Error ? error.message : String(error) },
				{ status: 500 }
			);
		}
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
