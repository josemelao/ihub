import { describe, expect, it } from 'vitest';
import { fetchPublicBytes, fetchPublicText, type HostResolver } from './safe-fetch';

const publicHost: HostResolver = async () => [{ address: '93.184.216.34', family: 4 }];

const fetcher =
	(body: Uint8Array, contentType = 'image/png') =>
	async () =>
		new Response(body as unknown as BodyInit, { headers: { 'content-type': contentType } });

describe('fetchPublicBytes', () => {
	it('devolve bytes e content-type de imagem', async () => {
		const result = await fetchPublicBytes('https://example.com/a.png', {
			resolver: publicHost,
			fetcher: fetcher(new Uint8Array([1, 2, 3]))
		});

		expect([...result.bytes]).toEqual([1, 2, 3]);
		expect(result.contentType).toContain('image/png');
	});

	it('aceita ico de favicon', async () => {
		const result = await fetchPublicBytes('https://example.com/favicon.ico', {
			resolver: publicHost,
			fetcher: fetcher(new Uint8Array([1, 2, 3]), 'image/x-icon')
		});

		expect([...result.bytes]).toEqual([1, 2, 3]);
		expect(result.contentType).toContain('image/x-icon');
	});

	it('rejeita content-type que não é imagem permitida', async () => {
		await expect(
			fetchPublicBytes('https://example.com/a.svg', {
				resolver: publicHost,
				fetcher: fetcher(new Uint8Array(), 'image/svg+xml')
			})
		).rejects.toThrow(/não suportado/i);
	});

	it('rejeita acima do limite de bytes', async () => {
		await expect(
			fetchPublicBytes('https://example.com/a.png', {
				resolver: publicHost,
				maxBytes: 2,
				fetcher: fetcher(new Uint8Array([1, 2, 3]))
			})
		).rejects.toThrow(/grande/i);
	});

	it('rejeita host que resolve para IP interno', async () => {
		await expect(
			fetchPublicBytes('https://interno.example/a.png', {
				resolver: async () => [{ address: '127.0.0.1', family: 4 }],
				fetcher: fetcher(new Uint8Array([1, 2, 3]))
			})
		).rejects.toThrow(/interno/i);
	});
});

describe('fetchPublicText', () => {
	it('usa o resolver injetado sem consultar o DNS', async () => {
		const result = await fetchPublicText('https://example.com/feed.xml', {
			resolver: publicHost,
			fetcher: async () =>
				new Response('<rss />', { headers: { 'content-type': 'application/rss+xml' } })
		});

		expect(result.text).toBe('<rss />');
	});
});
