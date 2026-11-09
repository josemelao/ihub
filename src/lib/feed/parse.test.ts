import { describe, it, expect } from 'vitest';
import { parseFeed } from './parse';

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Steam News</title>
    <item>
      <title>Notas do patch 1.2</title>
      <link>https://example.com/patch-1-2</link>
      <description><![CDATA[<p>Correções &amp; ajustes do <b>patch</b>.</p>]]></description>
      <pubDate>Mon, 09 Nov 2026 12:00:00 GMT</pubDate>
      <guid isPermaLink="false">steam-1</guid>
      <enclosure url="https://example.com/img.jpg" type="image/jpeg" />
    </item>
    <item>
      <title>Promoção da semana</title>
      <link>https://example.com/sale</link>
      <description>Descontos</description>
      <pubDate>Sun, 08 Nov 2026 10:00:00 GMT</pubDate>
      <guid>steam-2</guid>
    </item>
  </channel>
</rss>`;

const atom = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Blog</title>
  <entry>
    <title>Atualização importante</title>
    <link rel="alternate" href="https://blog.example.com/atualizacao" />
    <id>tag:blog.example.com,2026:1</id>
    <updated>2026-11-09T09:30:00Z</updated>
    <summary type="html">&lt;p&gt;Resumo &amp;amp; detalhes&lt;/p&gt;</summary>
  </entry>
</feed>`;

describe('parseFeed', () => {
	it('normaliza um feed RSS 2.0', () => {
		const items = parseFeed(rss, 'steam');

		expect(items).toHaveLength(2);
		expect(items[0]).toMatchObject({
			sourceId: 'steam',
			title: 'Notas do patch 1.2',
			url: 'https://example.com/patch-1-2',
			thumbnail: 'https://example.com/img.jpg'
		});
		expect(items[0].summary).toBe('Correções & ajustes do patch.');
		expect(items[0].publishedAt).toBe('2026-11-09T12:00:00.000Z');
		expect(items[0].id).toHaveLength(16);
	});

	it('normaliza um feed Atom', () => {
		const items = parseFeed(atom, 'blog');

		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({
			sourceId: 'blog',
			title: 'Atualização importante',
			url: 'https://blog.example.com/atualizacao',
			publishedAt: '2026-11-09T09:30:00.000Z'
		});
		expect(items[0].summary).toBe('Resumo & detalhes');
	});

	it('remove itens duplicados pela URL', () => {
		const duplicated = rss.replace('steam-2', 'steam-3');
		const items = parseFeed(
			duplicated.replace(
				/<link>https:\/\/example.com\/sale<\/link>/,
				'<link>https://example.com/patch-1-2</link>'
			),
			'steam'
		);
		expect(items).toHaveLength(1);
	});

	it('devolve lista vazia para XML inválido', () => {
		expect(parseFeed('isso não é xml', 'x')).toEqual([]);
	});

	it('extrai imagem de media:group', () => {
		const withMedia = `<rss version="2.0"><channel><item>
			<title>Vídeo</title>
			<link>https://www.youtube.com/watch?v=abc123def45</link>
			<description>Resumo</description>
			<media:group><media:thumbnail url="https://img.example/yt.jpg" /></media:group>
		</item></channel></rss>`;
		expect(parseFeed(withMedia, 'yt')[0].thumbnail).toBe('https://img.example/yt.jpg');
	});

	it('extrai a primeira imagem do HTML do conteúdo', () => {
		const withImg = `<rss version="2.0"><channel><item>
			<title>Post com imagem</title>
			<link>https://example.com/post</link>
			<description><![CDATA[<p>Texto</p><img src="https://example.com/foto.jpg" alt="" />]]></description>
		</item></channel></rss>`;
		expect(parseFeed(withImg, 'blog')[0].thumbnail).toBe('https://example.com/foto.jpg');
	});

	it('deriva thumbnail de link do YouTube', () => {
		const yt = `<rss version="2.0"><channel><item>
			<title>Vídeo</title>
			<link>https://www.youtube.com/watch?v=abc123def45</link>
			<description>Resumo</description>
		</item></channel></rss>`;
		expect(parseFeed(yt, 'yt')[0].thumbnail).toBe(
			'https://i.ytimg.com/vi/abc123def45/hqdefault.jpg'
		);
	});

	it('normaliza thumbnail antigo do YouTube vindo do feed', () => {
		const yt = `<rss version="2.0"><channel><item>
			<title>Vídeo</title>
			<link>https://www.youtube.com/watch?v=abc123def45</link>
			<description>Resumo</description>
			<media:thumbnail url="https://www.youtube.com/v/abc123def45?version=3" />
		</item></channel></rss>`;
		expect(parseFeed(yt, 'yt')[0].thumbnail).toBe(
			'https://i.ytimg.com/vi/abc123def45/hqdefault.jpg'
		);
	});

	it('limpa entidades numéricas e boilerplate do Reddit', () => {
		const reddit = `<rss version="2.0"><channel><item>
			<title>Post</title>
			<link>https://reddit.com/r/x/1</link>
			<description><![CDATA[Texto&#32;com espaços e &amp;#32;duplo. submitted by /u/teste [link] [comments]]]></description>
		</item></channel></rss>`;
		const summary = parseFeed(reddit, 'reddit')[0].summary;
		expect(summary).toBe('Texto com espaços e duplo.');
		expect(summary).not.toContain('submitted by');
		expect(summary).not.toContain('&#32;');
	});
});
