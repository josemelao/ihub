const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function youtubeVideoId(url: string, thumbnail?: string | null): string | null {
	try {
		const parsed = new URL(url);
		const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

		if (host === 'youtu.be') {
			const id = parsed.pathname.split('/').filter(Boolean)[0];
			return id && VIDEO_ID.test(id) ? id : null;
		}

		if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
			if (parsed.pathname === '/watch') {
				const id = parsed.searchParams.get('v');
				if (id && VIDEO_ID.test(id)) return id;
			}

			const pathMatch = parsed.pathname.match(
				/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})(?:[/?]|$)/
			);
			if (pathMatch) return pathMatch[1];
		}
	} catch {
		// tenta pela thumbnail abaixo
	}

	if (thumbnail) {
		const thumbMatch = thumbnail.match(
			/(?:i\.ytimg\.com|img\.youtube\.com)\/vi(?:_webp)?\/([A-Za-z0-9_-]{11})\//
		);
		if (thumbMatch) return thumbMatch[1];
	}

	return null;
}
