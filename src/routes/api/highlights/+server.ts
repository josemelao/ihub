import { json } from '@sveltejs/kit';
import { isInternalError, isRecord, readJsonLimited, RequestBodyError } from '#lib/net/body';
import { toSafeHttpUrl } from '#lib/net/url';
import {
	addHighlight,
	HighlightError,
	removeHighlight,
	updateHighlight
} from '#lib/reader/highlights';
import { getStorage } from '#lib/storage';
import type { HighlightColor } from '#lib/types';
import type { RequestHandler } from './$types';

const MAX_BODY_BYTES = 16_000;
const ITEM_ID = /^[A-Za-z0-9_-]{1,64}$/;

function highlightErrorResponse(error: unknown): Response | null {
	if (!(error instanceof HighlightError)) return null;
	return json(
		{ ok: false, error: error.message, code: error.code },
		{ status: error.code === 'not-found' ? 404 : 400 }
	);
}

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
			if (typeof parsed.itemId !== 'string' || !ITEM_ID.test(parsed.itemId)) {
				return json({ ok: false, error: 'Informe um itemId válido.' }, { status: 400 });
			}
			if (typeof parsed.quote !== 'string') {
				return json({ ok: false, error: 'Informe o trecho do destaque.' }, { status: 400 });
			}

			const [feed, state] = await Promise.all([storage.loadFeedCache(), storage.loadState()]);
			const live = feed.items.find((item) => item.id === parsed.itemId);
			const snapshot = state.savedItems?.[parsed.itemId];
			const title = live?.title ?? snapshot?.item.title;
			const url = toSafeHttpUrl(live?.url ?? snapshot?.item.url ?? '');
			if (!title || !url) {
				return json({ ok: false, error: 'Post não encontrado.' }, { status: 404 });
			}

			const input = {
				itemId: parsed.itemId,
				itemTitle: title,
				itemUrl: url,
				quote: parsed.quote,
				note: typeof parsed.note === 'string' ? parsed.note : undefined,
				color: typeof parsed.color === 'string' ? (parsed.color as HighlightColor) : undefined,
				occurrence: typeof parsed.occurrence === 'number' ? parsed.occurrence : undefined
			};
			const data = await storage.updateHighlights((current) => addHighlight(current, input));
			return json({ ok: true, highlights: data });
		}

		if (parsed.action === 'update') {
			if (typeof parsed.id !== 'string' || !parsed.id) {
				return json({ ok: false, error: 'Informe o id do destaque.' }, { status: 400 });
			}
			const data = await storage.updateHighlights((current) =>
				updateHighlight(current, parsed.id as string, {
					note:
						parsed.note === null ? null : typeof parsed.note === 'string' ? parsed.note : undefined,
					color: typeof parsed.color === 'string' ? (parsed.color as HighlightColor) : undefined
				})
			);
			return json({ ok: true, highlights: data });
		}

		if (parsed.action === 'delete') {
			if (typeof parsed.id !== 'string' || !parsed.id) {
				return json({ ok: false, error: 'Informe o id do destaque.' }, { status: 400 });
			}
			const data = await storage.updateHighlights((current) =>
				removeHighlight(current, parsed.id as string)
			);
			return json({ ok: true, highlights: data });
		}

		return json({ ok: false, error: 'Ação inválida.' }, { status: 400 });
	} catch (error) {
		const response = highlightErrorResponse(error);
		if (response) return response;
		if (!isInternalError(error) && error instanceof Error) {
			return json({ ok: false, error: error.message }, { status: 400 });
		}
		return json({ ok: false, error: 'Falha ao salvar o destaque.' }, { status: 500 });
	}
};
