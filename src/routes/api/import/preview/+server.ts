import { json } from '@sveltejs/kit';
import { buildImportPreview, type ImportMode } from '#lib/import-preview';
import { readJsonLimited, RequestBodyError } from '#lib/net/body';
import { HubValidationError, parseHub, parseHubState } from '#lib/schema';
import { getStorage } from '#lib/storage';
import type { ExportBundle } from '#lib/types';
import type { RequestHandler } from './$types';

const MAX_BODY_BYTES = 10_000_000;

interface PreviewPayload {
	bundle?: ExportBundle;
	mode?: ImportMode;
}

export const POST: RequestHandler = async ({ request }) => {
	let payload: PreviewPayload;

	try {
		payload = (await readJsonLimited(request, MAX_BODY_BYTES)) as PreviewPayload;
	} catch (error) {
		if (error instanceof RequestBodyError) {
			return json({ ok: false, error: error.message }, { status: error.status });
		}
		return json({ ok: false, error: 'Corpo da requisição não é um JSON válido.' }, { status: 400 });
	}

	if (!payload?.bundle?.hub) {
		return json({ ok: false, error: 'Envie um bundle exportado do hub.' }, { status: 400 });
	}

	if (payload.mode !== 'replace' && payload.mode !== 'merge') {
		return json({ ok: false, error: "Modo inválido: use 'replace' ou 'merge'." }, { status: 400 });
	}

	try {
		const incomingHub = parseHub(payload.bundle.hub);
		const incomingState = payload.bundle.state ? parseHubState(payload.bundle.state) : undefined;
		const storage = getStorage();

		let currentHub;
		try {
			currentHub = await storage.loadHub();
		} catch (error) {
			if (!(error instanceof HubValidationError)) throw error;
			const backup = await storage.loadHubFromBackup();
			if (!backup) throw error;
			currentHub = backup;
		}

		return json({
			ok: true,
			preview: buildImportPreview(currentHub, incomingHub, payload.mode, incomingState)
		});
	} catch (error) {
		if (error instanceof HubValidationError) {
			return json({ ok: false, error: error.message, issues: error.issues }, { status: 400 });
		}
		throw error;
	}
};
