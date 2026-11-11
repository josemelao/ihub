import { json } from '@sveltejs/kit';
import { applyFileImport, fileImportPayloadSchema } from '#lib/import/file-import';
import type { FileImportSummary } from '#lib/import/apply';
import { readJsonLimited, RequestBodyError } from '#lib/net/body';
import { HubValidationError } from '#lib/schema';
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

	let summary: FileImportSummary | null = null;

	try {
		await getStorage().updateHub((hub) => {
			const result = applyFileImport(
				hub,
				payload.data.format,
				payload.data.content,
				payload.data.categoryName
			);
			summary = result.summary;
			return result.hub;
		});
	} catch (error) {
		if (error instanceof HubValidationError) {
			return json({ ok: false, error: error.message, issues: error.issues }, { status: 400 });
		}
		throw error;
	}

	if (!summary) {
		return json({ ok: false, error: 'Nada foi importado.' }, { status: 400 });
	}

	return json({ ok: true, summary });
};
