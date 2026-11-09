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
		const items = parseFeed(duplicated.replace(/<link>https:\/\/example.com\/sale<\/link>/, '<link>https://example.com/patch-1-2</link>'), 'steam');
		expect(items).toHaveLength(1);
	});

	it('devolve lista vazia para XML inválido', () => {
		expect(parseFeed('isso não é xml', 'x')).toEqual([]);
	});
});
