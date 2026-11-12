import { describe, expect, it } from 'vitest';
import {
	ARCHIVE_CONTENT_SECURITY_POLICY,
	CONTENT_SECURITY_POLICY,
	SECURITY_HEADERS,
	withSecurityHeaders
} from './headers';
import { handle } from '../../hooks.server';

describe('security headers', () => {
	it('inclui headers básicos', () => {
		expect(SECURITY_HEADERS['x-content-type-options']).toBe('nosniff');
		expect(SECURITY_HEADERS['x-frame-options']).toBe('DENY');
		expect(SECURITY_HEADERS['referrer-policy']).toBe('no-referrer');
	});

	it('CSP permite players e imagens externas necessárias', () => {
		expect(CONTENT_SECURITY_POLICY).toContain("frame-src 'self'");
		expect(CONTENT_SECURITY_POLICY).toContain('https://www.youtube-nocookie.com');
		expect(CONTENT_SECURITY_POLICY).toContain('https://www.redditmedia.com');
		expect(CONTENT_SECURITY_POLICY).toContain("img-src 'self' https: data:");
		expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
	});

	it('não depende mais de fontes do Google', () => {
		expect(CONTENT_SECURITY_POLICY).not.toContain('fonts.googleapis.com');
		expect(CONTENT_SECURITY_POLICY).not.toContain('fonts.gstatic.com');
		expect(CONTENT_SECURITY_POLICY).toContain("font-src 'self' data:");
	});

	it('não libera eval', () => {
		expect(CONTENT_SECURITY_POLICY).not.toContain('unsafe-eval');
	});

	it('aplica a política com enforce, não Report-Only', () => {
		const response = withSecurityHeaders(new Response('ok'));

		expect(response.headers.get('content-security-policy')).toBe(CONTENT_SECURITY_POLICY);
		expect(response.headers.get('content-security-policy-report-only')).toBeNull();
	});

	it('preserva o corpo e o status originais', async () => {
		const response = withSecurityHeaders(new Response('corpo', { status: 201 }));

		expect(response.status).toBe(201);
		await expect(response.text()).resolves.toBe('corpo');
	});

	it('aplica CSP restrita ao arquivo', () => {
		const response = withSecurityHeaders(new Response('ok'), { archive: true });

		expect(response.headers.get('content-security-policy')).toBe(ARCHIVE_CONTENT_SECURITY_POLICY);
		expect(ARCHIVE_CONTENT_SECURITY_POLICY).toContain("script-src 'none'");
		expect(ARCHIVE_CONTENT_SECURITY_POLICY).toContain("img-src 'self'");
	});
});

describe('hooks.server aplica headers', () => {
	const event = (url: string, init?: RequestInit) =>
		({
			request: new Request(url, init),
			url: new URL(url)
		}) as unknown as Parameters<typeof handle>[0]['event'];

	it('responde HTML com CSP enforced', async () => {
		const response = await handle({
			event: event('http://127.0.0.1/'),
			resolve: async () =>
				new Response('<html></html>', { headers: { 'content-type': 'text/html' } })
		});

		expect(response.headers.get('content-security-policy')).toBe(CONTENT_SECURITY_POLICY);
		expect(response.headers.get('content-security-policy-report-only')).toBeNull();
		expect(response.headers.get('x-frame-options')).toBe('DENY');
	});

	it('responde API com os mesmos headers', async () => {
		const response = await handle({
			event: event('http://127.0.0.1/api/hub'),
			resolve: async () => new Response('{}', { headers: { 'content-type': 'application/json' } })
		});

		expect(response.headers.get('content-security-policy')).toBe(CONTENT_SECURITY_POLICY);
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
	});

	it('mantém o bloqueio de Host desconhecido', async () => {
		const response = await handle({
			event: event('http://127.0.0.1/', { headers: { host: 'evil.test' } }),
			resolve: async () => new Response('não deveria chegar')
		});

		expect(response.status).toBe(403);
	});

	it('aplica CSP restrita em /arquivo', async () => {
		const response = await handle({
			event: event('http://127.0.0.1/arquivo/abc'),
			resolve: async () =>
				new Response('<html></html>', { headers: { 'content-type': 'text/html' } })
		});

		expect(response.headers.get('content-security-policy')).toBe(ARCHIVE_CONTENT_SECURITY_POLICY);
	});
});
