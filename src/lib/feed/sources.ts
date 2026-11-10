import { fetchPublicText } from '../net/safe-fetch';
import type { FeedSource } from '../types';

const YOUTUBE_CHANNEL_ID = /^UC[\w-]{20,}$/;
const YOUTUBE_FEED_BASE = 'https://www.youtube.com/feeds/videos.xml?channel_id=';

export function youtubeFeedUrl(channelId: string): string {
	return `${YOUTUBE_FEED_BASE}${channelId}`;
}

export function parseYouTubeChannelId(value: string): string | null {
	const patterns = [
		/itemprop=["']identifier["']\s+content=["'](UC[\w-]{20,})["']/i,
		/"channelId"\s*:\s*"(UC[\w-]{20,})"/,
		/channel_id=(UC[\w-]{20,})/
	];

	for (const pattern of patterns) {
		const match = value.match(pattern);
		if (match) return match[1];
	}

	return null;
}

export function youtubePageUrlFor(target: string): string | null {
	const trimmed = target.trim();
	if (!trimmed) return null;
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	if (/^(www\.)?youtube\.com\//i.test(trimmed)) return `https://${trimmed}`;
	if (trimmed.startsWith('@')) return `https://www.youtube.com/${trimmed}`;
	return `https://www.youtube.com/@${trimmed}`;
}

export interface YouTubeResolveOptions {
	fetcher?: (input: string, init?: RequestInit) => Promise<Response>;
	timeoutMs?: number;
}

export async function resolveYouTubeChannelId(
	target: string,
	options: YouTubeResolveOptions = {}
): Promise<string> {
	const trimmed = target.trim();
	if (!trimmed) throw new Error('Informe o canal do YouTube.');

	if (YOUTUBE_CHANNEL_ID.test(trimmed)) return trimmed;

	const fromFeed = parseYouTubeChannelId(trimmed);
	if (fromFeed) return fromFeed;

	const pageUrl = youtubePageUrlFor(trimmed);
	if (!pageUrl) throw new Error('Canal do YouTube inválido.');

	let url: URL;
	try {
		url = new URL(pageUrl);
	} catch {
		throw new Error('Canal do YouTube inválido.');
	}

	const host = url.hostname.toLowerCase();
	if (host !== 'youtube.com' && host !== 'www.youtube.com' && !host.endsWith('.youtube.com')) {
		throw new Error('Use um canal do YouTube.');
	}

	const direct = url.pathname.match(/^\/channel\/(UC[\w-]{20,})/);
	if (direct) return direct[1];

	const { text } = await fetchPublicText(url.toString(), {
		fetcher: options.fetcher as typeof fetch | undefined,
		timeoutMs: options.timeoutMs
	});
	const channelId = parseYouTubeChannelId(text);
	if (!channelId) {
		throw new Error('Não foi possível encontrar o ID do canal nesta página do YouTube.');
	}

	return channelId;
}

export async function resolveFeedUrl(
	source: FeedSource,
	options: YouTubeResolveOptions = {}
): Promise<string> {
	try {
		return feedUrlFor(source);
	} catch (error) {
		if (source.type !== 'youtube') throw error;
		const channelId = await resolveYouTubeChannelId(source.target, options);
		return youtubeFeedUrl(channelId);
	}
}

export function feedUrlFor(source: FeedSource): string {
	switch (source.type) {
		case 'rss':
			return source.target;

		case 'reddit': {
			const target = source.target.trim();
			if (target.startsWith('http://') || target.startsWith('https://')) return target;
			const subreddit = target.replace(/^\/?r\//i, '').replace(/\/+$/, '');
			return `https://www.reddit.com/r/${subreddit}/new.rss`;
		}

		case 'youtube': {
			const target = source.target.trim();
			if (target.includes('feeds/videos.xml')) return target;
			if (YOUTUBE_CHANNEL_ID.test(target)) {
				return youtubeFeedUrl(target);
			}
			try {
				const url = new URL(target);
				const channelId = url.searchParams.get('channel_id');
				if (channelId) {
					return youtubeFeedUrl(channelId);
				}
			} catch {
				// cai no erro explicativo abaixo
			}
			throw new Error(
				'Para YouTube, use o @handle, o ID do canal (UC...) ou a URL do feed videos.xml?channel_id=...'
			);
		}
	}
}
