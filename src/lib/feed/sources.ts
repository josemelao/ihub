import type { FeedSource } from '../types';

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
			if (/^UC[\w-]{20,}$/.test(target)) {
				return `https://www.youtube.com/feeds/videos.xml?channel_id=${target}`;
			}
			try {
				const url = new URL(target);
				const channelId = url.searchParams.get('channel_id');
				if (channelId) {
					return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
				}
			} catch {
				// cai no erro explicativo abaixo
			}
			throw new Error(
				'Para YouTube, use o ID do canal (UC...) ou a URL do feed videos.xml?channel_id=...'
			);
		}
	}
}
