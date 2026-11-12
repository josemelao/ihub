import { json } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { EMPTY_HUB } from '#lib/defaults';
import { isInternalError, isRecord, readJsonLimited, RequestBodyError } from '#lib/net/body';
import { parseHub } from '#lib/schema';
import { getStorage } from '#lib/storage';
import type { RequestHandler } from './$types';

const MAX_BODY_BYTES = 16_000;

/**
 * Primeiro uso: só roda quando `hub.json` ainda não existe. Cria o hub de
 * exemplo (seed versionado) ou um hub vazio.
 */
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

	if (!isRecord(parsed) || (parsed.mode !== 'example' && parsed.mode !== 'empty')) {
		return json({ ok: false, error: 'Informe mode: "example" ou "empty".' }, { status: 400 });
	}

	const storage = getStorage();
	if (await storage.hasHub()) {
		return json({ ok: false, error: 'O hub.json já existe.' }, { status: 409 });
	}

	try {
		const hub =
			parsed.mode === 'example'
				? parseHub(
						JSON.parse(await readFile(join(process.cwd(), 'data', 'hub.example.json'), 'utf8'))
					)
				: parseHub(EMPTY_HUB);
		await storage.saveHub(hub);
		return json({ ok: true, mode: parsed.mode });
	} catch (error) {
		if (!isInternalError(error) && error instanceof Error) {
			return json({ ok: false, error: error.message }, { status: 400 });
		}
		return json({ ok: false, error: 'Falha ao criar o hub.json.' }, { status: 500 });
	}
};
