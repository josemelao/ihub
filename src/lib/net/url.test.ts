import { describe, expect, it } from 'vitest';
import { assertSafeHttpUrl, isSafeHttpUrl, toSafeHttpUrl } from './url';

describe('toSafeHttpUrl', () => {
	it('aceita http e https', () => {
		expect(toSafeHttpUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
		expect(toSafeHttpUrl('http://example.com')).toBe('http://example.com/');
	});

	it('rejeita esquemas perigosos e valores inválidos', () => {
		expect(toSafeHttpUrl('javascript:alert(1)')).toBeNull();
		expect(toSafeHttpUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
		expect(toSafeHttpUrl('file:///C:/Windows')).toBeNull();
		expect(toSafeHttpUrl('vbscript:msgbox(1)')).toBeNull();
		expect(toSafeHttpUrl('não é url')).toBeNull();
		expect(toSafeHttpUrl('')).toBeNull();
		expect(toSafeHttpUrl(null)).toBeNull();
	});

	it('isSafeHttpUrl e assertSafeHttpUrl refletem a validação', () => {
		expect(isSafeHttpUrl('https://example.com')).toBe(true);
		expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
		expect(assertSafeHttpUrl('https://example.com')).toBe('https://example.com/');
		expect(() => assertSafeHttpUrl('javascript:alert(1)')).toThrow(/inválida/i);
	});
});
