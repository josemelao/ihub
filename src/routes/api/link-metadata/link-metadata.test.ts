import { describe, expect, it } from 'vitest';
import { POST } from './+server';
import type { RequestHandler } from './$types';

function event(body: unknown): Parameters<RequestHandler>[0] {
	return {
		request: new Request('http://127.0.0.1/api/link-metadata', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	} as Parameters<RequestHandler>[0];
}

describe('POST /api/link-metadata', () => {
	it('rejects non-http URLs without fetching', async () => {
		const response = await POST(event({ url: 'javascript:alert(1)' }));
		expect(response.status).toBe(400);
	});

	it('rejects a missing URL', async () => {
		const response = await POST(event({}));
		expect(response.status).toBe(400);
	});

	it('rejects an invalid JSON body', async () => {
		const response = await POST({
			request: new Request('http://127.0.0.1/api/link-metadata', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: '{'
			})
		} as Parameters<RequestHandler>[0]);
		expect(response.status).toBe(400);
	});
});
