import { json } from '@sveltejs/kit';
import { FeedFormatError, feedFormatOf, parseFeed } from '#lib/feed/parse';
import { matchesSourceRules } from '#lib/feed/filter';
import { resolveFeedUrl } from '#lib/feed/sources';
import { fetchPublicText } from '#lib/net/safe-fetch';
import { isInternalError, isRecord, readJsonLimited, RequestBodyError } from '#lib/net/body';
import type { FeedSource, MatchMode } from '#lib/types';
import type { RequestHandler } from './$types';

const MAX_BODY_BYTES = 64_000;
const MAX_RESPONSE_BYTES = 2_000_000;
const TIMEOUT_MS = 8_000;
const PREVIEW_TITLES = 3;

function matchModeOf(value: unknown): MatchMode {
	return value === 'all' ? 'all' : 'any';
}

function stringsOf(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((entry): entry is string => typeof entry === 'string')
		: [];
}

/** Testa uma fonte sem gravar nada: busca, faz parse e aplica as regras. */
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

	if (!isRecord(parsed) || typeof parsed.target !== 'string' || !parsed.target.trim()) {
		return json({ ok: false, error: 'Informe a URL ou o canal da fonte.' }, { status: 400 });
	}

	const draft: FeedSource = {
		id: 'teste',
		type: parsed.type === 'youtube' || parsed.type === 'reddit' ? parsed.type : 'rss',
		name: 'Teste',
		target: parsed.target.trim(),
		categoryId: 'teste',
		intervalMinutes: 30,
		enabled: true,
		include: stringsOf(parsed.include),
		exclude: stringsOf(parsed.exclude),
		matchMode: matchModeOf(parsed.matchMode)
	};

	try {
		const url = await resolveFeedUrl(draft, { timeoutMs: TIMEOUT_MS });
		const { text, finalUrl } = await fetchPublicText(url, {
			timeoutMs: TIMEOUT_MS,
			maxBytes: MAX_RESPONSE_BYTES
		});

		if (feedFormatOf(text) !== 'invalid') {
			const items = parseFeed(text, draft.id);
			const filtered = items.filter((item) => matchesSourceRules(item, draft));
			return json({
				ok: true,
				finalUrl,
				total: items.length,
				filtered: filtered.length,
				titles: items.slice(0, PREVIEW_TITLES).map((item) => item.title),
				sample: items.slice(0, PREVIEW_TITLES).map((item) => ({
					title: item.title,
					url: item.url
				}))
			});
		}

		return json({ ok: false, error: new FeedFormatError().message }, { status: 422 });
	} catch (error) {
		if (error instanceof FeedFormatError) {
			return json({ ok: false, error: error.message }, { status: 422 });
		}
		if (!isInternalError(error) && error instanceof Error) {
			return json({ ok: false, error: error.message }, { status: 422 });
		}
		return json({ ok: false, error: 'Falha ao testar a fonte.' }, { status: 500 });
	}
};
