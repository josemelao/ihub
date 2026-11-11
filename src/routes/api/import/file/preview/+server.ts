import { json } from '@sveltejs/kit';
import { fileImportPayloadSchema, previewFileImport } from '#lib/import/file-import';
import { readJsonLimited, RequestBodyError } from '#lib/net/body';
import { getStorage } from '#lib/storage';
import type { RequestHandler } from './$types';

const MAX_BODY_BYTES = 10_000_000;

export const POST: RequestHandler = async ({ request }) => {
	let raw: unknown;

	try {
		raw = await readJsonLimited(request, MAX_BODY_BYTES);
	} catch (error) {
		if (error instanceof RequestBodyError) {
			return json({ ok: false, error: error.message }, { status: error.status });
		}
		return json({ ok: false, error: 'Corpo da requisição não é um JSON válido.' }, { status: 400 });
	}

	const payload = fileImportPayloadSchema.safeParse(raw);
	if (!payload.success) {
		return json(
			{ ok: false, error: payload.error.issues[0]?.message ?? 'Arquivo inválido.' },
			{ status: 400 }
		);
	}

	const { hub } = await getStorage().loadHubWithFallback();
	const preview = previewFileImport(
		hub,
		payload.data.format,
		payload.data.content,
		payload.data.categoryName
	);

	return json({ ok: true, preview });
};
