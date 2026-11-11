import { json } from '@sveltejs/kit';
import { parseLinkMetadata } from '#lib/link-metadata';
import { readJsonLimited, RequestBodyError } from '#lib/net/body';
import { fetchPublicText } from '#lib/net/safe-fetch';
import { toSafeHttpUrl } from '#lib/net/url';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const MAX_BODY_BYTES = 64_000;

const payloadSchema = z.object({
	url: z.string().trim().min(1, 'Informe uma URL.')
});

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

	const payload = payloadSchema.safeParse(raw);
	if (!payload.success) {
		return json(
			{ ok: false, error: payload.error.issues[0]?.message ?? 'URL inválida.' },
			{ status: 400 }
		);
	}

	const url = toSafeHttpUrl(payload.data.url);
	if (!url) {
		return json({ ok: false, error: 'Use uma URL http:// ou https://.' }, { status: 400 });
	}

	try {
		const { text, finalUrl } = await fetchPublicText(url, {
			timeoutMs: 5_000,
			maxBytes: 1_000_000
		});
		return json({ ok: true, metadata: parseLinkMetadata(text, finalUrl) });
	} catch (error) {
		return json({
			ok: false,
			error: error instanceof Error ? error.message : 'Não foi possível ler a página.'
		});
	}
};
