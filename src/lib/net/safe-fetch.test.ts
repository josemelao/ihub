import { describe, it, expect } from 'vitest';
import { assertSafeUrl, isAllowedContentType, isPrivateIp, readTextLimited } from './safe-fetch';

describe('isPrivateIp', () => {
	it('reconhece faixas privadas e reservadas', () => {
		for (const address of [
			'127.0.0.1',
			'10.1.2.3',
			'172.16.0.1',
			'192.168.1.1',
			'169.254.1.1',
			'100.64.0.1',
			'0.0.0.0',
			'::1',
			'fd00::1',
			'fe80::1'
		]) {
			expect(isPrivateIp(address), address).toBe(true);
		}
	});

	it('aceita IPs públicos', () => {
		expect(isPrivateIp('8.8.8.8')).toBe(false);
		expect(isPrivateIp('2606:4700:4700::1111')).toBe(false);
	});
});

describe('assertSafeUrl', () => {
	it('rejeita loopback e localhost', async () => {
		await expect(assertSafeUrl('http://127.0.0.1/')).rejects.toThrow(/interno/i);
		await expect(assertSafeUrl('http://localhost/')).rejects.toThrow(/interno/i);
	});

	it('rejeita protocolos não http', async () => {
		await expect(assertSafeUrl('file:///etc/passwd')).rejects.toThrow(/http/i);
	});
});

describe('isAllowedContentType', () => {
	it('aceita html, texto e xml', () => {
		expect(isAllowedContentType('text/html; charset=utf-8')).toBe(true);
		expect(isAllowedContentType('application/rss+xml')).toBe(true);
		expect(isAllowedContentType(null)).toBe(true);
	});

	it('rejeita binários', () => {
		expect(isAllowedContentType('image/png')).toBe(false);
	});
});

describe('readTextLimited', () => {
	it('lê o corpo normalmente', async () => {
		const response = new Response('conteúdo');
		expect(await readTextLimited(response, 100)).toBe('conteúdo');
	});

	it('rejeita corpo acima do limite', async () => {
		const response = new Response('0123456789');
		await expect(readTextLimited(response, 5)).rejects.toThrow(/muito grande/i);
	});
});
