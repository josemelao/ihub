function decodeEntities(value: string): string {
	return value
		.replace(/&amp;/gi, '&')
		.replace(/&quot;/gi, '"')
		.replace(/&#0?39;/gi, "'")
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>');
}

function parseAttributes(tag: string): Record<string, string> {
	const attributes: Record<string, string> = {};
	const pattern = /([a-zA-Z_:][\w:.-]*)\s*=\s*["']([^"']*)["']/g;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(tag)) !== null) {
		attributes[match[1].toLowerCase()] = decodeEntities(match[2]);
	}
	return attributes;
}

function looksLikeFeed(content: string): boolean {
	return /^\s*(?:<\?xml[^>]*>\s*)?<(?:rss|feed|rdf:RDF)\b/i.test(content);
}

export function discoverFeedUrl(html: string, baseUrl: string): string | null {
	if (!html) return null;
	if (looksLikeFeed(html)) return baseUrl;

	const candidates: { url: string; priority: number }[] = [];
	const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];

	for (const tag of linkTags) {
		const attributes = parseAttributes(tag);
		const rel = (attributes.rel ?? '').toLowerCase();
		const type = (attributes.type ?? '').toLowerCase();
		const href = attributes.href;

		if (!href) continue;
		const isAlternate = rel.split(/\s+/).includes('alternate');
		const isFeedType = type.includes('rss') || type.includes('atom') || type.includes('xml');
		if (!isAlternate && !isFeedType) continue;
		if (!isFeedType) continue;

		try {
			const url = new URL(href, baseUrl).toString();
			candidates.push({
				url,
				priority: type.includes('rss') || type.includes('atom') ? 2 : 1
			});
		} catch {
			// href inválido: tenta o próximo
		}
	}

	if (candidates.length === 0) return null;
	candidates.sort((a, b) => b.priority - a.priority);
	return candidates[0].url;
}
