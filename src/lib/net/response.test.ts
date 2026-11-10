import { describe, expect, it } from 'vitest';
import { HttpResponseError, readJsonResponse } from './response';

function response(body: string, init: ResponseInit = {}): Response {
	return new Response(body, init);
}

describe('readJsonResponse', () => {
	it('devolve o JSON de uma resposta 200', async () => {
		const result = await readJsonResponse<{ ok: boolean }>(
			response(JSON.stringify({ ok: true }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		);

		expect(result).toEqual({ ok: true });
	});

	it('devolve o JSON de erro para o chamador tratar', async () => {
		const result = await readJsonResponse<{ ok: boolean; error: string }>(
			response(JSON.stringify({ ok: false, error: 'Falhou' }), {
				status: 400,
				headers: { 'content-type': 'application/json; charset=utf-8' }
			})
		);

		expect(result).toEqual({ ok: false, error: 'Falhou' });
	});

	it('transforma 403 em texto puro em erro legível', async () => {
		const promise = readJsonResponse(
			response('Cross-site POST form submissions are forbidden', {
				status: 403,
				headers: { 'content-type': 'text/plain' }
			})
		);

		await expect(promise).rejects.toBeInstanceOf(HttpResponseError);
		await expect(promise).rejects.toMatchObject({
			status: 403,
			message: expect.stringContaining('Cross-site')
		});
	});

	it('transforma HTML de erro em erro legível', async () => {
		const promise = readJsonResponse(
			response('<html><body>Internal Error</body></html>', {
				status: 500,
				headers: { 'content-type': 'text/html' }
			})
		);

		await expect(promise).rejects.toMatchObject({ status: 500 });
		await expect(promise).rejects.toThrow(/HTTP 500/);
	});

	it('explica corpo vazio sem JSON', async () => {
		const promise = readJsonResponse(response('', { status: 502 }));

		await expect(promise).rejects.toThrow(/corpo vazio/i);
	});

	it('explica JSON inválido mesmo com content-type JSON', async () => {
		const promise = readJsonResponse(
			response('{quebrado', {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		);

		await expect(promise).rejects.toMatchObject({ status: 200 });
		await expect(promise).rejects.toThrow(/JSON inválido/i);
	});
});
