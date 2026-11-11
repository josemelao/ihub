import { describe, expect, it } from 'vitest';
import { redditPostInfo } from './reddit';

describe('redditPostInfo com percent-encoding inválido', () => {
	it('devolve null para subreddit com % malformado', () => {
		expect(redditPostInfo('https://www.reddit.com/r/%E0%A4%A/comments/abc123/')).toBeNull();
	});

	it('devolve null para slug com % malformado', () => {
		expect(redditPostInfo('https://www.reddit.com/r/Darktide/comments/abc123/%E0%A4%A')).toBeNull();
	});

	it('continua lendo slug codificado corretamente', () => {
		const info = redditPostInfo('https://www.reddit.com/r/Darktide/comments/abc123/patchnotes/');

		expect(info?.slug).toBe('patchnotes');
	});
});
