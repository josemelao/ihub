import { mapWithConcurrency } from '../feed/concurrency';
import { fetchPublicText } from '../net/safe-fetch';
import type { HubItem, LinkHealthData, LinkHealthEntry } from '../types';
import { normalizeLinkUrl } from './duplicates';

export type TextFetcher = (url: string) => Promise<{ text: string; finalUrl: string }>;

export interface CheckLinksOptions {
	fetchText?: TextFetcher;
	now?: () => Date;
	concurrency?: number;
	timeoutMs?: number;
	maxBytes?: number;
}

function failureEntry(error: unknown, checkedAt: string): LinkHealthEntry {
	const message = (error instanceof Error ? error.message : String(error)).slice(0, 300);

	if (/timeout|timed out|aborted/i.test(message)) {
		return { status: 'timeout', message: 'Tempo esgotado.', checkedAt };
	}

	const code = /HTTP (\d{3})/.exec(message)?.[1];
	if (code) {
		const status = Number(code);
		return {
			status: status >= 400 && status < 500 ? 'broken' : 'error',
			code: status,
			message,
			checkedAt
		};
	}

	return { status: 'error', message, checkedAt };
}

/** Verifica todos os links do hub, isolando falhas por item. */
export async function checkLinks(
	items: HubItem[],
	options: CheckLinksOptions = {}
): Promise<LinkHealthData> {
	const now = options.now ?? (() => new Date());
	const checkedAt = now().toISOString();
	const timeoutMs = options.timeoutMs ?? 8_000;
	const fetchText =
		options.fetchText ??
		((url: string) =>
			fetchPublicText(url, {
				maxBytes: options.maxBytes ?? 1_000_000,
				timeoutMs
			}));

	const links = items.filter((item) => item.type === 'link');
	const entries: Record<string, LinkHealthEntry> = {};

	await mapWithConcurrency(links, options.concurrency ?? 4, async (item) => {
		try {
			const { finalUrl } = await fetchText(item.url);
			const before = normalizeLinkUrl(item.url);
			const after = normalizeLinkUrl(finalUrl);
			if (after && before && after !== before) {
				entries[item.id] = { status: 'redirect', finalUrl, checkedAt };
			} else {
				entries[item.id] = { status: 'ok', checkedAt };
			}
		} catch (error) {
			entries[item.id] = failureEntry(error, checkedAt);
		}
		return null;
	});

	return { version: 1, checkedAt, entries };
}
