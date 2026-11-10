import { describe, expect, it } from 'vitest';
import { CONTENT_SECURITY_POLICY, SECURITY_HEADERS } from './headers';

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
		expect(CONTENT_SECURITY_POLICY).toContain('https://fonts.googleapis.com');
		expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
	});

	it('não libera eval', () => {
		expect(CONTENT_SECURITY_POLICY).not.toContain('unsafe-eval');
	});
});
