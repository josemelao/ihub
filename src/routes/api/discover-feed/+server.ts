import { json } from '@sveltejs/kit';
import { discoverFeedUrl } from '#lib/feed/discover';
import { youtubeFeedUrl, youtubePageUrlFor } from '#lib/feed/sources';
import { readJsonLimited, RequestBodyError } from '#lib/net/body';
import { fetchPublicText } from '#lib/net/safe-fetch';
import type { RequestHandler } from './$types';

const MAX_RESPONSE_BYTES = 5_000_000;
const MAX_BODY_BYTES = 64_000;

export const POST: RequestHandler = async ({ request }) => {
	let payload: { url?: string };
	try {
		payload = (await readJsonLimited(request, MAX_BODY_BYTES)) as { url?: string };
	} catch (error) {
		if (error instanceof RequestBodyError) {
			return json({ ok: false, error: error.message }, { status: error.status });
		}
		return json({ ok: false, error: 'Corpo JSON inválido.' }, { status: 400 });
	}

	const target = payload.url?.trim();
	if (!target) {
		return json({ ok: false, error: 'Informe a URL da página ou do feed.' }, { status: 400 });
	}

	if (/^UC[\w-]{20,}$/.test(target)) {
		return json({ ok: true, feedUrl: youtubeFeedUrl(target) });
	}

	const normalized =
		target.startsWith('@') || /^(www\.)?youtube\.com\//i.test(target)
			? youtubePageUrlFor(target)
			: target;
	if (!normalized) {
		return json({ ok: false, error: 'URL inválida.' }, { status: 400 });
	}

	let parsed: URL;
	try {
		parsed = new URL(normalized);
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
