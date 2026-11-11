import { describe, expect, it } from 'vitest';
import { buildQuickAddHref } from './quick-add';

describe('buildQuickAddHref', () => {
	it('builds an encoded deep link with metadata', () => {
		const href = buildQuickAddHref('http://127.0.0.1:5757', 'https://example.com/artigo?x=1&y=2', {
			name: 'Título & cia',
			description: 'Resumo curto',
			icon: 'https://example.com/icon.png'
		});
		const url = new URL(href);

		expect(url.origin).toBe('http://127.0.0.1:5757');
		expect(url.pathname).toBe('/gerenciar');
		expect(url.searchParams.get('tab')).toBe('itens');
		expect(url.searchParams.get('add')).toBe('link');
		expect(url.searchParams.get('url')).toBe('https://example.com/artigo?x=1&y=2');
		expect(url.searchParams.get('name')).toBe('Título & cia');
		expect(url.searchParams.get('description')).toBe('Resumo curto');
		expect(url.searchParams.get('icon')).toBe('https://example.com/icon.png');
	});

	it('omits empty metadata and unsafe icons', () => {
		const href = buildQuickAddHref('http://127.0.0.1:5757', 'https://example.com/', {
			name: '   ',
			description: '',
			icon: 'javascript:alert(1)'
		});
		const url = new URL(href);

		expect(url.searchParams.has('name')).toBe(false);
		expect(url.searchParams.has('description')).toBe(false);
		expect(url.searchParams.has('icon')).toBe(false);
	});

	it('falls back to the plain add link for unsafe URLs', () => {
		const href = buildQuickAddHref('http://127.0.0.1:5757', 'javascript:alert(1)');
		const url = new URL(href);

		expect(url.pathname).toBe('/gerenciar');
		expect(url.searchParams.get('tab')).toBe('itens');
		expect(url.searchParams.get('add')).toBe('link');
		expect(url.searchParams.has('url')).toBe(false);
	});

	it('handles a base URL with a trailing slash', () => {
		const href = buildQuickAddHref('http://localhost:5757/', 'https://example.com/');
		expect(href.startsWith('http://localhost:5757/gerenciar?')).toBe(true);
	});
});
