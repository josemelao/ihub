import { json } from '@sveltejs/kit';
import { discoverFeedUrl } from '#lib/feed/discover';
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

	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		return json({ ok: false, error: 'Use uma URL http:// ou https://.' }, { status: 400 });
	}

	try {
		const response = await fetch(parsed.toString(), {
			headers: {
				'user-agent': 'MeuHub/0.1 (hub pessoal local)',
				accept: 'text/html, application/rss+xml, application/atom+xml, application/xml, */*'
			},
			signal: AbortSignal.timeout(10_000)
		});

		if (!response.ok) {
			return json(
				{ ok: false, error: `A página respondeu HTTP ${response.status}.` },
				{ status: 502 }
			);
		}

		const text = await response.text();
		if (text.length > MAX_RESPONSE_BYTES) {
			return json({ ok: false, error: 'Resposta muito grande.' }, { status: 502 });
		}

		const feedUrl = discoverFeedUrl(text, parsed.toString());
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
