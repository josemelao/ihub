import { json } from '@sveltejs/kit';
import { isRedditVideoHtml, redditPostInfo } from '#lib/feed/reddit';
import { fetchPublicText } from '#lib/net/safe-fetch';
import type { RequestHandler } from './$types';

const MAX_RESPONSE_BYTES = 5_000_000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_LIMIT = 200;

interface CachedResult {
	isVideo: boolean;
	embedUrl: string;
	expires: number;
}

const cache = new Map<string, CachedResult>();

export const POST: RequestHandler = async ({ request }) => {
	let payload: { url?: string };
	try {
		payload = (await request.json()) as { url?: string };
	} catch {
		return json({ ok: false, error: 'Corpo JSON inválido.' }, { status: 400 });
	}

	const target = payload.url?.trim();
	if (!target) {
		return json({ ok: false, error: 'Informe a URL do post do Reddit.' }, { status: 400 });
	}

	const info = redditPostInfo(target);
	if (!info) {
		return json({ ok: false, error: 'URL de post do Reddit inválida.' }, { status: 400 });
	}

	const cached = cache.get(info.id);
	if (cached && cached.expires > Date.now()) {
		return json({
			ok: true,
			isVideo: cached.isVideo,
			embedUrl: cached.embedUrl,
			cached: true
		});
	}

	try {
		const { text } = await fetchPublicText(info.embedUrl, {
			maxBytes: MAX_RESPONSE_BYTES,
			timeoutMs: 10_000
		});
		const isVideo = isRedditVideoHtml(text);

		if (cache.size >= CACHE_LIMIT) cache.clear();
		cache.set(info.id, {
			isVideo,
			embedUrl: info.embedUrl,
			expires: Date.now() + CACHE_TTL_MS
		});

		return json({ ok: true, isVideo, embedUrl: info.embedUrl });
	} catch (error) {
		return json(
			{
				ok: false,
				error: `Não foi possível consultar o Reddit: ${
					error instanceof Error ? error.message : String(error)
				}`
			},
			{ status: 502 }
		);
	}
};
