export interface RedditPostInfo {
	subreddit: string;
	id: string;
	slug: string;
	canonicalUrl: string;
	embedUrl: string;
}

function safeDecode(value: string): string | null {
	try {
		return decodeURIComponent(value);
	} catch {
		return null;
	}
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

	const subreddit = safeDecode(match[1]);
	const id = match[2];
	const slug = match[3] ? safeDecode(match[3]) : '';

	if (subreddit === null || slug === null) return null;

	if (!/^[A-Za-z0-9_]+$/.test(subreddit) || !/^[A-Za-z0-9]+$/.test(id)) return null;

	const suffix = slug ? `/${encodeURIComponent(slug)}` : '';
	return {
		subreddit,
		id,
		slug,
		canonicalUrl: `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/comments/${id}${suffix}/`,
		// Embed oficial: aceita iframe (frame-ancestors *) e renderiza vídeo,
		// imagem única e carrossel. O antigo redditmedia.com passou a dar 403.
		embedUrl: `https://embed.reddit.com/r/${encodeURIComponent(subreddit)}/comments/${id}${suffix}/`
	};
}

/**
 * O RSS do Reddit entrega prévias assinadas (`preview.redd.it`) com largura
 * fixa — muitas vezes 140 px. O arquivo original fica em `i.redd.it` com o
 * mesmo caminho, então trocamos o host e descartamos a query.
 */
export function redditFullImage(url: string | null | undefined): string | null {
	if (!url) return null;
	try {
		const parsed = new URL(url);
		if (parsed.hostname.toLowerCase() !== 'preview.redd.it') return null;
		return `https://i.redd.it${parsed.pathname}`;
	} catch {
		return null;
	}
}

/**
 * Heurística para o botão "Ver no player": o Reddit usa
 * `external-preview.redd.it` para vídeos (e mídia externa); galerias e imagens
 * hospedadas usam `preview.redd.it`. Sem consultar o Reddit, é o sinal
 * disponível no RSS.
 */
export function redditLikelyVideo(url: string | null | undefined): boolean {
	if (!url) return false;
	try {
		return new URL(url).hostname.toLowerCase() === 'external-preview.redd.it';
	} catch {
		return false;
	}
}
