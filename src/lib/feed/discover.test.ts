import { describe, it, expect } from 'vitest';
import { discoverFeedUrl } from './discover';

describe('discoverFeedUrl', () => {
	it('encontra link RSS relativo e resolve a URL', () => {
		const html = `<html><head>
			<link rel="alternate" type="application/rss+xml" href="/feed.xml" />
		</head></html>`;
		expect(discoverFeedUrl(html, 'https://example.com/noticias')).toBe(
			'https://example.com/feed.xml'
		);
	});

	it('encontra link Atom absoluto', () => {
		const html = `<head><link href="https://blog.example.com/atom.xml" type="application/atom+xml" rel="alternate"></head>`;
		expect(discoverFeedUrl(html, 'https://example.com')).toBe('https://blog.example.com/atom.xml');
	});

	it('reconhece quando a própria resposta já é um feed', () => {
		const xml = `<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>`;
		expect(discoverFeedUrl(xml, 'https://example.com/feed')).toBe('https://example.com/feed');
	});

	it('devolve null quando não há feed', () => {
		expect(
			discoverFeedUrl('<html><head><title>Sem feed</title></head></html>', 'https://example.com')
		).toBeNull();
	});
});
