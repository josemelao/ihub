import { json } from '@sveltejs/kit';
import { readJsonLimited, RequestBodyError } from '#lib/net/body';
import { HubValidationError } from '#lib/schema';
import { getStorage } from '#lib/storage';
import type { ExportBundle } from '#lib/types';
import type { RequestHandler } from './$types';

const MAX_BODY_BYTES = 10_000_000;

interface ImportPayload {
	bundle?: ExportBundle;
	mode?: 'replace' | 'merge';
}

export const POST: RequestHandler = async ({ request }) => {
	let payload: ImportPayload;

	try {
		payload = (await readJsonLimited(request, MAX_BODY_BYTES)) as ImportPayload;
	} catch (error) {
		if (error instanceof RequestBodyError) {
			return json({ ok: false, error: error.message }, { status: error.status });
		}
		return json({ ok: false, error: 'Corpo da requisição não é um JSON válido.' }, { status: 400 });
	}

	if (!payload || typeof payload !== 'object' || !payload.bundle?.hub) {
		return json({ ok: false, error: 'Envie um bundle exportado do hub.' }, { status: 400 });
	}

	const mode = payload.mode;
	if (mode !== 'replace' && mode !== 'merge') {
		return json({ ok: false, error: "Modo inválido: use 'replace' ou 'merge'." }, { status: 400 });
	}

	try {
		await getStorage().importBundle(payload.bundle, mode);

		return json({
			ok: true,
			summary: {
				categories: payload.bundle.hub.categories?.length ?? 0,
				groups: payload.bundle.hub.groups?.length ?? 0,
				items: payload.bundle.hub.items?.length ?? 0,
				feedSources: payload.bundle.hub.feedSources?.length ?? 0
			}
		});
	} catch (error) {
		if (error instanceof HubValidationError) {
			return json({ ok: false, error: error.message, issues: error.issues }, { status: 400 });
		}
		throw error;
	}
};
