import { describe, expect, it } from 'vitest';
import { POST } from './+server';
import type { RequestHandler } from './$types';

function event(body: unknown): Parameters<RequestHandler>[0] {
	return {
		request: new Request('http://127.0.0.1/api/reddit-media', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	} as Parameters<RequestHandler>[0];
}

describe('POST /api/reddit-media', () => {
	it('responde 400 para URL com percent-encoding inválido', async () => {
		const response = await POST(
			event({ url: 'https://www.reddit.com/r/%E0%A4%A/comments/abc123/' })
		);

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({ ok: false });
	});
});
