import { describe, expect, it } from 'vitest';
import { youtubeVideoId } from './youtube';

describe('youtubeVideoId', () => {
	it('extrai o ID de watch URLs', () => {
		expect(youtubeVideoId('https://www.youtube.com/watch?v=x_sotLdc45E')).toBe('x_sotLdc45E');
		expect(youtubeVideoId('https://youtube.com/watch?v=haOswVv_-GU&t=10')).toBe('haOswVv_-GU');
	});

	it('extrai o ID de youtu.be, shorts, embed e live', () => {
		expect(youtubeVideoId('https://youtu.be/x_sotLdc45E')).toBe('x_sotLdc45E');
		expect(youtubeVideoId('https://www.youtube.com/shorts/x_sotLdc45E')).toBe('x_sotLdc45E');
		expect(youtubeVideoId('https://www.youtube.com/embed/x_sotLdc45E')).toBe('x_sotLdc45E');
		expect(youtubeVideoId('https://www.youtube.com/live/x_sotLdc45E')).toBe('x_sotLdc45E');
	});

	it('usa a thumbnail como fallback', () => {
		expect(
			youtubeVideoId(
				'https://example.com/video',
				'https://i.ytimg.com/vi/x_sotLdc45E/hqdefault.jpg'
			)
		).toBe('x_sotLdc45E');
		expect(
			youtubeVideoId(
				'https://example.com/video',
				'https://i.ytimg.com/vi_webp/x_sotLdc45E/hqdefault.webp'
			)
		).toBe('x_sotLdc45E');
	});

	it('devolve null para URLs que não são do YouTube', () => {
		expect(youtubeVideoId('https://example.com/watch?v=x_sotLdc45E')).toBeNull();
		expect(youtubeVideoId('https://www.youtube.com/feed/subscriptions')).toBeNull();
		expect(youtubeVideoId('não é url')).toBeNull();
	});
});
