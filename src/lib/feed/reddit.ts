export interface RedditPostInfo {
	subreddit: string;
	id: string;
	slug: string;
	canonicalUrl: string;
	embedUrl: string;
}

export function redditPostInfo(url: string): RedditPostInfo | null {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return null;
	}

	const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
	if (host !== 'reddit.com' && !host.endsWith('.reddit.com')) return null;

	const match = parsed.pathname.match(/^\/r\/([^/]+)\/comments\/([a-z0-9]+)(?:\/([^/?#]*))?/i);
	if (!match) return null;

	const subreddit = decodeURIComponent(match[1]);
	const id = match[2];
	const slug = match[3] ? decodeURIComponent(match[3]) : '';

	if (!/^[A-Za-z0-9_]+$/.test(subreddit) || !/^[A-Za-z0-9]+$/.test(id)) return null;

	const suffix = slug ? `/${encodeURIComponent(slug)}` : '';
	return {
		subreddit,
		id,
		slug,
		canonicalUrl: `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/comments/${id}${suffix}/`,
		embedUrl: `https://www.redditmedia.com/r/${encodeURIComponent(subreddit)}/comments/${id}${suffix}/?embed=true&showmedia=1`
	};
}

export function isRedditVideoHtml(html: string): boolean {
	return /v\.redd\.it|"type"\s*:\s*"video"|&quot;type&quot;:&quot;video&quot;|"is_video"\s*:\s*true|HLSPlaylist/i.test(
		html
	);
}

export function redditEmbedUrlWithLocale(embedUrl: string, locale?: string): string {
	if (!locale) return embedUrl;
	try {
		const url = new URL(embedUrl);
		url.searchParams.set('locale', locale);
		return url.toString();
	} catch {
		return embedUrl;
	}
}
