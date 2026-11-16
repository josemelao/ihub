import { json } from '@sveltejs/kit';
import { EMPTY_USAGE } from '#lib/defaults';
import { isRecord, readJsonLimited, RequestBodyError } from '#lib/net/body';
import { getStorage } from '#lib/storage';
import { recordUsage } from '#lib/usage';
import type { RequestHandler } from './$types';

const MAX_BODY_BYTES = 4_096;
const ITEM_ID = /^[A-Za-z0-9_-]{1,64}$/;

export const GET: RequestHandler = async () => {
	return json(await getStorage().loadUsage());
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

	if (!isRecord(parsed) || typeof parsed.id !== 'string' || !ITEM_ID.test(parsed.id)) {
		return json({ ok: false, error: 'Payload inválido.' }, { status: 400 });
	}

	const storage = getStorage();
	const hub = await storage.loadHub();
	if (!hub.items.some((item) => item.id === parsed.id)) {
		return json({ ok: false, error: 'Item não encontrado.' }, { status: 404 });
	}

	const usage = await storage.updateUsage((current) =>
		recordUsage(current, parsed.id as string, new Date().toISOString())
	);
	return json({ ok: true, usage });
};

export const DELETE: RequestHandler = async () => {
	await getStorage().saveUsage(structuredClone(EMPTY_USAGE));
	return json({ ok: true });
};
