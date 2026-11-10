import { describe, expect, it } from 'vitest';
import { readJsonLimited, RequestBodyError } from './body';

function request(body: string, headers: Record<string, string> = {}): Request {
	return new Request('http://127.0.0.1/api', {
		method: 'POST',
		body,
		headers
	});
}

describe('readJsonLimited', () => {
	it('lê JSON dentro do limite', async () => {
		await expect(readJsonLimited(request('{"ok":true}'), 1024)).resolves.toEqual({ ok: true });
	});

	it('rejeita pelo content-length', async () => {
		await expect(
			readJsonLimited(request('{"ok":true}', { 'content-length': '999999' }), 1024)
		).rejects.toMatchObject({ status: 413 });
	});

	it('rejeita pelo tamanho real do stream', async () => {
		const body = JSON.stringify({ data: 'x'.repeat(200) });
		await expect(readJsonLimited(request(body), 64)).rejects.toBeInstanceOf(RequestBodyError);
		await expect(readJsonLimited(request(body), 64)).rejects.toMatchObject({ status: 413 });
	});

	it('rejeita JSON inválido', async () => {
		await expect(readJsonLimited(request('{'), 1024)).rejects.toMatchObject({ status: 400 });
	});
});
