import { json } from '@sveltejs/kit';
import { readJsonLimited, RequestBodyError } from '#lib/net/body';
import { HubValidationError } from '#lib/schema';
import { getStorage } from '#lib/storage';
import type { RequestHandler } from './$types';

const MAX_BODY_BYTES = 64_000;

export const POST: RequestHandler = async ({ request }) => {
	let payload: { id?: unknown };
	try {
		payload = (await readJsonLimited(request, MAX_BODY_BYTES)) as { id?: unknown };
	} catch (error) {
		if (error instanceof RequestBodyError) {
			return json({ ok: false, error: error.message }, { status: error.status });
		}
		return json({ ok: false, error: 'Corpo JSON inválido.' }, { status: 400 });
	}

	if (typeof payload?.id !== 'string' || !payload.id) {
		return json({ ok: false, error: 'Informe o id do ponto de restauração.' }, { status: 400 });
	}

	try {
		const result = await getStorage().restoreBackup(payload.id);
		return json({ ok: true, ...result });
	} catch (error) {
		if (error instanceof HubValidationError) {
			return json({ ok: false, error: error.message, issues: error.issues }, { status: 400 });
		}
		return json(
			{ ok: false, error: error instanceof Error ? error.message : String(error) },
			{ status: 500 }
		);
	}
};
