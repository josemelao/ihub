import { describe, it, expect } from 'vitest';
import { feedUrlFor } from './sources';
import type { FeedSource } from '../types';

const source = (overrides: Partial<FeedSource>): FeedSource => ({
	id: 's',
	type: 'rss',
	name: 'Fonte',
	target: 'https://example.com/feed',
	categoryId: 'jogos',
	intervalMinutes: 30,
	enabled: true,
	include: [],
	exclude: [],
	matchMode: 'any',
	...overrides
});

describe('feedUrlFor', () => {
	it('usa a URL direta de RSS', () => {
		expect(feedUrlFor(source({ type: 'rss' }))).toBe('https://example.com/feed');
	});

	it('monta o feed de um subreddit a partir do nome', () => {
		expect(feedUrlFor(source({ type: 'reddit', target: 'Darktide' }))).toBe(
			'https://www.reddit.com/r/Darktide/new.rss'
		);
		expect(feedUrlFor(source({ type: 'reddit', target: 'r/Darktide/' }))).toBe(
			'https://www.reddit.com/r/Darktide/new.rss'
		);
	});

	it('mantém URL de subreddit já completa', () => {
		expect(feedUrlFor(source({ type: 'reddit', target: 'https://www.reddit.com/r/x/.rss' }))).toBe(
			'https://www.reddit.com/r/x/.rss'
		);
	});

	it('monta o feed do YouTube a partir do channel ID', () => {
		expect(feedUrlFor(source({ type: 'youtube', target: 'UCBJycsmduvYEL83R_U4JriQ' }))).toBe(
			'https://www.youtube.com/feeds/videos.xml?channel_id=UCBJycsmduvYEL83R_U4JriQ'
		);
	});

	it('aceita URL de feed do YouTube ou com channel_id', () => {
		expect(
			feedUrlFor(
				source({
					type: 'youtube',
					target: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC12345678901234567890'
				})
			)
		).toBe('https://www.youtube.com/feeds/videos.xml?channel_id=UC12345678901234567890');
	});

	it('explica quando o alvo do YouTube é inválido', () => {
		expect(() => feedUrlFor(source({ type: 'youtube', target: 'https://youtube.com/@canal' }))).toThrow(
			/ID do canal/i
		);
	});
});
