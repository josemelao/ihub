import { beforeEach, describe, it, expect, vi } from 'vitest';
import { fetchPublicText } from '../net/safe-fetch';
import {
	feedUrlFor,
	parseYouTubeChannelId,
	resolveFeedUrl,
	resolveYouTubeChannelId
} from './sources';
import type { FeedSource } from '../types';

vi.mock('../net/safe-fetch', () => ({
	fetchPublicText: vi.fn()
}));

const fetchTextMock = vi.mocked(fetchPublicText);
const CHANNEL_ID = 'UCy7DyzEEC9h81lmwg6H5rlw';
const channelHtml = `<html><meta itemprop="identifier" content="${CHANNEL_ID}"></html>`;

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

beforeEach(() => {
	fetchTextMock.mockReset();
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
		expect(feedUrlFor(source({ type: 'youtube', target: CHANNEL_ID }))).toBe(
			`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`
		);
	});

	it('aceita URL de feed do YouTube ou com channel_id', () => {
		expect(
			feedUrlFor(
				source({
					type: 'youtube',
					target: `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`
				})
			)
		).toBe(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`);
	});

	it('explica quando o alvo do YouTube é inválido', () => {
		expect(() =>
			feedUrlFor(source({ type: 'youtube', target: 'https://youtube.com/@canal' }))
		).toThrow(/@handle/i);
	});
});

describe('YouTube', () => {
	it('extrai o channel ID do HTML', () => {
		expect(parseYouTubeChannelId(channelHtml)).toBe(CHANNEL_ID);
		expect(parseYouTubeChannelId(`"channelId":"${CHANNEL_ID}"`)).toBe(CHANNEL_ID);
		expect(parseYouTubeChannelId('sem canal')).toBeNull();
	});

	it('extrai o channel ID direto de /channel/ sem buscar a página', async () => {
		const id = await resolveYouTubeChannelId(`https://www.youtube.com/channel/${CHANNEL_ID}`);
		expect(id).toBe(CHANNEL_ID);
		expect(fetchTextMock).not.toHaveBeenCalled();
	});

	it('resolve @handle buscando a página do canal', async () => {
		fetchTextMock.mockResolvedValue({ text: channelHtml, finalUrl: 'https://youtube.com/' });

		await expect(resolveYouTubeChannelId('@MisterEtide')).resolves.toBe(CHANNEL_ID);
		expect(fetchTextMock).toHaveBeenCalledTimes(1);
		expect(fetchTextMock.mock.calls[0][0]).toBe('https://www.youtube.com/@MisterEtide');
	});

	it('resolve o feed a partir de @handle', async () => {
		fetchTextMock.mockResolvedValue({ text: channelHtml, finalUrl: 'https://youtube.com/' });

		await expect(resolveFeedUrl(source({ type: 'youtube', target: '@MisterEtide' }))).resolves.toBe(
			`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`
		);
	});

	it('rejeita domínio que não é do YouTube sem fazer requisição', async () => {
		await expect(resolveYouTubeChannelId('https://example.com/@canal')).rejects.toThrow(
			/canal do YouTube/i
		);
		expect(fetchTextMock).not.toHaveBeenCalled();
	});

	it('explica quando não encontra o ID na página', async () => {
		fetchTextMock.mockResolvedValue({ text: '<html></html>', finalUrl: 'https://youtube.com/' });

		await expect(resolveYouTubeChannelId('@canal')).rejects.toThrow(/ID do canal/i);
	});
});
