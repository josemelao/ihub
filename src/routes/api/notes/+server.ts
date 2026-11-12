import { json } from '@sveltejs/kit';
import { quickNoteOf, removeNote, upsertNote } from '#lib/notes';
import { isInternalError, isRecord, readJsonLimited, RequestBodyError } from '#lib/net/body';
import { HubValidationError } from '#lib/schema';
import { getStorage } from '#lib/storage';
import type { RequestHandler } from './$types';

const MAX_BODY_BYTES = 64_000;

export const GET: RequestHandler = async () => {
	return json(await getStorage().loadNotes());
};

export const POST: RequestHandler = async ({ request }) => {
	let parsed: unknown;
	try {
		parsed = await readJsonLimited(request, MAX_BODY_BYTES);
	} catch (error) {
		if (error instanceof RequestBodyError) {
			return json({ ok: false, error: error.message }, { status: error.status });
		}
		return json({ ok: false, error: 'Corpo JSON inválido.' }, { status: 400 });
	}

	if (!isRecord(parsed) || typeof parsed.action !== 'string' || !parsed.action) {
		return json({ ok: false, error: 'Payload inválido: informe "action".' }, { status: 400 });
	}

	const storage = getStorage();

	try {
		if (parsed.action === 'save') {
			if (typeof parsed.text !== 'string') {
				return json({ ok: false, error: 'Informe o texto da nota.' }, { status: 400 });
			}
			if (parsed.text.length > 4000) {
				return json(
					{ ok: false, error: 'A nota passa do limite de 4.000 caracteres.' },
					{ status: 400 }
				);
			}
			const id = typeof parsed.id === 'string' ? parsed.id : undefined;
			const notes = await storage.updateNotes((current) =>
				upsertNote(current, { id, text: parsed.text as string })
			);
			return json({ ok: true, notes, quick: quickNoteOf(notes) });
		}

		if (parsed.action === 'delete') {
			if (typeof parsed.id !== 'string' || !parsed.id) {
				return json({ ok: false, error: 'Informe o id da nota.' }, { status: 400 });
			}
			const notes = await storage.updateNotes((current) =>
				removeNote(current, parsed.id as string)
			);
			return json({ ok: true, notes, quick: quickNoteOf(notes) });
		}

		return json({ ok: false, error: `Ação desconhecida: ${parsed.action}.` }, { status: 400 });
	} catch (error) {
		if (error instanceof HubValidationError) {
			return json({ ok: false, error: error.message, issues: error.issues }, { status: 400 });
		}
		if (!isInternalError(error) && error instanceof Error) {
			return json({ ok: false, error: error.message }, { status: 400 });
		}
		return json({ ok: false, error: 'Falha ao salvar a nota.' }, { status: 500 });
	}
};
