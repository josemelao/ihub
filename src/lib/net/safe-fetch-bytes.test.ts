import { describe, expect, it } from 'vitest';
import { fetchPublicBytes } from './safe-fetch';

const fetcher =
	(body: Uint8Array, contentType = 'image/png') =>
	async () =>
		new Response(body as unknown as BodyInit, { headers: { 'content-type': contentType } });

describe('fetchPublicBytes', () => {
	it('devolve bytes e content-type de imagem', async () => {
		const result = await fetchPublicBytes('https://example.com/a.png', {
			fetcher: fetcher(new Uint8Array([1, 2, 3]))
		});

		expect([...result.bytes]).toEqual([1, 2, 3]);
		expect(result.contentType).toContain('image/png');
	});

	it('rejeita content-type que não é imagem permitida', async () => {
		await expect(
			fetchPublicBytes('https://example.com/a.svg', {
				fetcher: fetcher(new Uint8Array(), 'image/svg+xml')
			})
		).rejects.toThrow(/não suportado/i);
	});

	it('rejeita acima do limite de bytes', async () => {
		await expect(
			fetchPublicBytes('https://example.com/a.png', {
				maxBytes: 2,
				fetcher: fetcher(new Uint8Array([1, 2, 3]))
			})
		).rejects.toThrow(/grande/i);
	});
});
