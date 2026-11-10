import { describe, expect, it } from 'vitest';
import { isRedditVideoHtml, redditPostInfo } from './reddit';

describe('redditPostInfo', () => {
	it('extrai subreddit, id, slug e URLs do post', () => {
		const info = redditPostInfo(
			'https://www.reddit.com/r/DarkTide/comments/1xskv1q/another_round_of_clips/?utm_source=share'
		);

		expect(info).toMatchObject({
			subreddit: 'DarkTide',
			id: '1xskv1q',
			slug: 'another_round_of_clips'
		});
		expect(info?.canonicalUrl).toBe(
			'https://www.reddit.com/r/DarkTide/comments/1xskv1q/another_round_of_clips/'
		);
		expect(info?.embedUrl).toBe(
			'https://www.redditmedia.com/r/DarkTide/comments/1xskv1q/another_round_of_clips/?embed=true&showmedia=1'
		);
	});

	it('aceita old.reddit.com e m.reddit.com', () => {
		expect(redditPostInfo('https://old.reddit.com/r/DarkTide/comments/abc123/titulo/')?.id).toBe(
			'abc123'
		);
		expect(redditPostInfo('https://m.reddit.com/r/DarkTide/comments/abc123/titulo/')?.id).toBe(
			'abc123'
		);
	});

	it('devolve null para URLs que não são posts do Reddit', () => {
		expect(redditPostInfo('https://example.com/r/DarkTide/comments/abc123/titulo/')).toBeNull();
		expect(redditPostInfo('https://www.reddit.com/r/DarkTide/')).toBeNull();
		expect(redditPostInfo('não é url')).toBeNull();
	});
});

describe('isRedditVideoHtml', () => {
	it('detecta marcadores de vídeo', () => {
		expect(isRedditVideoHtml('https://v.redd.it/abc/HLSPlaylist.m3u8')).toBe(true);
		expect(isRedditVideoHtml('"type":"video"')).toBe(true);
		expect(isRedditVideoHtml('&quot;type&quot;:&quot;video&quot;')).toBe(true);
		expect(isRedditVideoHtml('"is_video":true')).toBe(true);
	});

	it('não marca páginas sem vídeo', () => {
		expect(isRedditVideoHtml('<html><img src="https://preview.redd.it/a.jpeg"></html>')).toBe(
			false
		);
		expect(isRedditVideoHtml('')).toBe(false);
	});
});
