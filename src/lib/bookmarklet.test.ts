import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildBookmarklet } from './bookmarklet';

afterEach(() => {
	vi.unstubAllGlobals();
});

function runBookmarklet(baseUrl: string, href: string, title: string): string[] {
	const opened: string[] = [];
	vi.stubGlobal('location', { href });
	vi.stubGlobal('document', { title });
	vi.stubGlobal('window', { open: (url: string) => opened.push(url) });

	const code = buildBookmarklet(baseUrl).replace(/^javascript:/, '');
	new Function(code)();

	return opened;
}

describe('buildBookmarklet', () => {
	it('opens the manager with the current page URL and title', () => {
		const opened = runBookmarklet(
			'http://127.0.0.1:5757',
			'https://example.com/artigo?x=1&y=2',
			'Título & cia'
		);

		expect(opened).toHaveLength(1);
		const url = new URL(opened[0]);
		expect(url.origin).toBe('http://127.0.0.1:5757');
		expect(url.pathname).toBe('/gerenciar');
		expect(url.searchParams.get('tab')).toBe('itens');
		expect(url.searchParams.get('add')).toBe('link');
		expect(url.searchParams.get('url')).toBe('https://example.com/artigo?x=1&y=2');
		expect(url.searchParams.get('name')).toBe('Título & cia');
	});

	it('falls back to the URL when the page has no title', () => {
		const opened = runBookmarklet('http://localhost:5757/', 'https://example.com/', '');

		expect(new URL(opened[0]).searchParams.get('name')).toBe('https://example.com/');
	});

	it('returns a javascript: URL with the app base normalized', () => {
		const code = buildBookmarklet('http://localhost:5757/');
		expect(code.startsWith('javascript:')).toBe(true);
		expect(code).toContain('http://localhost:5757/gerenciar?tab=itens&add=link');
		expect(code).not.toContain('5757//gerenciar');
	});
});
