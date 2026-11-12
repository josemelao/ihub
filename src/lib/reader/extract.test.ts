import { describe, expect, it } from 'vitest';
import { extractReadable, ReaderError, sanitizeArticleHtml } from './extract';

const page = (body: string) =>
	`<!doctype html><html><head><title>Notícia</title></head><body>
	<nav><a href="/home">Menu</a></nav><main><article>${body}</article></main>
	<aside>Anúncio</aside><script>alert('xss')</script></body></html>`;
const paragraphs = `<p>${'Conteúdo real da notícia. '.repeat(80)}</p>`;

describe('extração e sanitização', () => {
	it('extrai o conteúdo principal e descarta navegação/script', () => {
		const result = extractReadable(page(paragraphs), 'https://exemplo.com/noticia');

		expect(result.title).toContain('Notícia');
		expect(result.text).toContain('Conteúdo real');
		expect(result.html).not.toContain('<script');
		expect(result.html).not.toContain('Anúncio');
	});

	it('resolve URLs relativas contra a URL final', () => {
		const html = sanitizeArticleHtml(
			'<p><a href="/x">x</a><img src="img/a.png"></p>',
			'https://exemplo.com/post/1'
		);

		expect(html).toContain('href="https://exemplo.com/x"');
		expect(html).toContain('src="https://exemplo.com/post/img/a.png"');
	});

	it('separa blocos com espaço no texto extraído', () => {
		const html = `<html><body><article><p>${'Primeiro parágrafo. '.repeat(6)}</p><p>${'Segundo parágrafo. '.repeat(6)}</p></article></body></html>`;
		const result = extractReadable(html, 'https://e.com/');

		expect(result.text).toContain('parágrafo. Segundo parágrafo.');
	});

	it('sanitiza HTML diretamente no ponto de entrada', () => {
		const html = sanitizeArticleHtml(
			'<p onclick="x()">ok</p><script>alert(1)</script>',
			'https://e.com/'
		);

		expect(html).toContain('ok');
		expect(html).not.toContain('script');
		expect(html).not.toContain('onclick');
	});

	it('remove javascript:, data: e atributos de evento', () => {
		const html = sanitizeArticleHtml(
			'<a href="javascript:alert(1)">x</a><img src="data:image/png;base64,AA" onerror="alert(1)"><p onclick="x()">ok</p>',
			'https://exemplo.com/'
		);

		expect(html).not.toContain('javascript:');
		expect(html).not.toContain('data:image');
		expect(html).not.toContain('onerror');
		expect(html).not.toContain('onclick');
	});

	it('rejeita HTML sanitizado acima de 2 MB', () => {
		const huge = `<p>${'x'.repeat(2_100_000)}</p>`;

		expect(() => sanitizeArticleHtml(huge, 'https://exemplo.com/')).toThrow(ReaderError);
	});

	it('trunca o texto em 200k chars e preserva length original', () => {
		const long = `<p>${'palavra '.repeat(40_000)}</p>`;
		const result = extractReadable(page(long), 'https://exemplo.com/longo');

		expect(result.text.length).toBe(200_000);
		expect(result.length).toBeGreaterThan(200_000);
	});

	it('falha com no-content quando não há conteúdo principal', () => {
		expect(() => extractReadable(page(''), 'https://exemplo.com/vazio')).toThrow(ReaderError);
	});
});
