import { describe, expect, it } from 'vitest';
import { redditFullImage, redditLikelyVideo, redditPostInfo } from './reddit';

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
			'https://embed.reddit.com/r/DarkTide/comments/1xskv1q/another_round_of_clips/'
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

describe('redditLikelyVideo', () => {
	it('marca external-preview como vídeo provável', () => {
		expect(
			redditLikelyVideo('https://external-preview.redd.it/cWV3Zmg2eWFyYjFp.png?width=640')
		).toBe(true);
	});

	it('não marca prévias de imagem nem i.redd.it', () => {
		expect(redditLikelyVideo('https://preview.redd.it/0gmcgoqkdd1i1.png?width=140')).toBe(false);
		expect(redditLikelyVideo('https://i.redd.it/0gmcgoqkdd1i1.png')).toBe(false);
	});

	it('ignora vazio e URL inválida', () => {
		expect(redditLikelyVideo(null)).toBe(false);
		expect(redditLikelyVideo('')).toBe(false);
		expect(redditLikelyVideo('não é url')).toBe(false);
	});
});

describe('redditFullImage', () => {
	it('troca a prévia por i.redd.it, sem query', () => {
		expect(
			redditFullImage(
				'https://preview.redd.it/0gmcgoqkdd1i1.png?width=140&height=104&auto=webp&s=abc'
			)
		).toBe('https://i.redd.it/0gmcgoqkdd1i1.png');
	});

	it('mantém o caminho de prévias menores de 640', () => {
		expect(redditFullImage('https://preview.redd.it/0di0wi95951i1.png?width=640&crop=smart')).toBe(
			'https://i.redd.it/0di0wi95951i1.png'
		);
	});

	it('não tenta derivar de external-preview ou de outros hosts', () => {
		expect(
			redditFullImage(
				'https://external-preview.redd.it/cWV3Zmg2eWFyYjFpMY1tU7jKuktCJipiBCcg7af9zSHk0ZI.png'
			)
		).toBeNull();
		expect(redditFullImage('https://example.com/preview.redd.it/a.png')).toBeNull();
		expect(redditFullImage('')).toBeNull();
		expect(redditFullImage(null)).toBeNull();
	});
});
