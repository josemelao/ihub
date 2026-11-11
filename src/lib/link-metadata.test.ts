import { describe, expect, it } from 'vitest';
import { parseLinkMetadata } from './link-metadata';

describe('parseLinkMetadata', () => {
	it('extracts title, description and icon', () => {
		const html = `<!doctype html><html><head>
			<title>Meu &amp; Site</title>
			<meta name="description" content="Descrição &quot;curta&quot;.">
			<link rel="icon" href="/favicon.png">
		</head></html>`;

		expect(parseLinkMetadata(html, 'https://example.com/artigo')).toEqual({
			name: 'Meu & Site',
			description: 'Descrição "curta".',
			icon: 'https://example.com/favicon.png'
		});
	});

	it('falls back to og:description', () => {
		const html = `<head>
			<title>Página</title>
			<meta property="og:description" content="Resumo social">
		</head>`;

		expect(parseLinkMetadata(html, 'https://example.com/').description).toBe('Resumo social');
	});

	it('accepts meta tags in any attribute order', () => {
		const html = `<meta content="Ordem trocada" name="description"><title>T</title>`;

		expect(parseLinkMetadata(html, 'https://example.com/').description).toBe('Ordem trocada');
	});

	it('ignores unsafe icons', () => {
		const html = `<title>T</title><link rel="icon" href="javascript:alert(1)">`;

		expect(parseLinkMetadata(html, 'https://example.com/').icon).toBeNull();
	});

	it('resolves protocol-relative icons', () => {
		const html = `<title>T</title><link rel="shortcut icon" href="//cdn.example.com/i.png">`;

		expect(parseLinkMetadata(html, 'https://example.com/').icon).toBe(
			'https://cdn.example.com/i.png'
		);
	});

	it('falls back to the hostname when the title is missing', () => {
		expect(parseLinkMetadata('<html></html>', 'https://example.com/artigo').name).toBe(
			'example.com'
		);
	});

	it('truncates long descriptions to 280 characters', () => {
		const html = `<title>T</title><meta name="description" content="${'a'.repeat(400)}">`;

		expect(parseLinkMetadata(html, 'https://example.com/').description).toHaveLength(280);
	});
});
