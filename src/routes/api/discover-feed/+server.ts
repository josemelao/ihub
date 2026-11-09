import { json } from '@sveltejs/kit';
import { discoverFeedUrl } from '#lib/feed/discover';
import { fetchPublicText } from '#lib/net/safe-fetch';
import type { RequestHandler } from './$types';

const MAX_RESPONSE_BYTES = 5_000_000;

export const POST: RequestHandler = async ({ request }) => {
	let payload: { url?: string };
	try {
		payload = (await request.json()) as { url?: string };
	} catch {
		return json({ ok: false, error: 'Corpo JSON inválido.' }, { status: 400 });
	}

	const target = payload.url?.trim();
	if (!target) {
		return json({ ok: false, error: 'Informe a URL da página ou do feed.' }, { status: 400 });
	}

	let parsed: URL;
	try {
		parsed = new URL(target);
	} catch {
		return json({ ok: false, error: 'URL inválida.' }, { status: 400 });
	}

	try {
		const { text, finalUrl } = await fetchPublicText(parsed.toString(), {
			maxBytes: MAX_RESPONSE_BYTES,
			timeoutMs: 10_000
		});
		const feedUrl = discoverFeedUrl(text, finalUrl);

		if (!feedUrl) {
			return json(
				{ ok: false, error: 'Nenhum feed RSS/Atom encontrado nesta página.' },
				{ status: 404 }
			);
		}

		return json({ ok: true, feedUrl });
	} catch (error) {
		return json(
			{
				ok: false,
				error: `Não foi possível acessar a URL: ${
					error instanceof Error ? error.message : String(error)
				}`
			},
			{ status: 502 }
		);
	}
};
