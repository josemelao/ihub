import { describe, expect, it } from 'vitest';
import { feedFormatOf, parseFeed } from './parse';

const atom = (links: string, extra = '') => `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Feed</title>
  <entry>
    <title>Item</title>
    ${links}
    <id>urn:item-1</id>
    <updated>2026-01-01T00:00:00Z</updated>
    ${extra}
  </entry>
</feed>`;

describe('parseFeed com Atom', () => {
	it('prefere rel="alternate" mesmo quando o self vem antes', () => {
		const xml = atom(`
      <link rel="self" href="https://exemplo.test/feed.xml"/>
      <link rel="alternate" href="https://exemplo.test/post"/>
    `);

		expect(parseFeed(xml, 'fonte')[0]?.url).toBe('https://exemplo.test/post');
	});

	it('usa o primeiro link quando nenhum tem rel', () => {
		const xml = atom('<link href="https://exemplo.test/post"/>');

		expect(parseFeed(xml, 'fonte')[0]?.url).toBe('https://exemplo.test/post');
	});

	it('cai para o primeiro link seguro quando só existe self', () => {
		const xml = atom('<link rel="self" href="https://exemplo.test/feed.xml"/>');

		expect(parseFeed(xml, 'fonte')[0]?.url).toBe('https://exemplo.test/feed.xml');
	});

	it('ignora enclosure e edit', () => {
		const xml = atom(`
      <link rel="enclosure" href="https://exemplo.test/audio.mp3"/>
      <link rel="edit" href="https://exemplo.test/edit"/>
      <link rel="alternate" href="https://exemplo.test/post"/>
    `);

		expect(parseFeed(xml, 'fonte')[0]?.url).toBe('https://exemplo.test/post');
	});

	it('lê dc:date quando não há outra data', () => {
		const xml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
  <item>
    <title>Antigo</title>
    <link>https://exemplo.test/antigo</link>
    <dc:date>2026-02-03T04:05:06Z</dc:date>
  </item>
</channel></rss>`;

		expect(parseFeed(xml, 'fonte')[0]?.publishedAt).toBe('2026-02-03T04:05:06.000Z');
	});

	it('mantém data vazia quando o valor é inválido', () => {
		const xml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
  <item>
    <title>Sem data</title>
    <link>https://exemplo.test/sem-data</link>
    <dc:date>ontem</dc:date>
  </item>
</channel></rss>`;

		expect(parseFeed(xml, 'fonte')[0]?.publishedAt).toBe('');
	});
});

describe('feedFormatOf com conteúdo comum de geradores', () => {
	it('aceita BOM e linha em branco antes do XML', () => {
		const xml =
			'\uFEFF\n<?xml version="1.0"?><rss version="2.0"><channel><title>F</title></channel></rss>';

		expect(feedFormatOf(xml)).toBe('rss');
	});

	it('aceita espaços antes da declaração XML', () => {
		const xml = '  \n  <?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"></feed>';

		expect(feedFormatOf(xml)).toBe('atom');
	});

	it('aceita XML tolerante com & solto quando a raiz é um feed', () => {
		const xml = '<rss version="2.0"><channel><title>Tom & Jerry</title></channel></rss>';

		expect(feedFormatOf(xml)).toBe('rss');
	});

	it('continua recusando HTML', () => {
		expect(feedFormatOf('<html><body>oi</body></html>')).toBe('invalid');
	});
});

describe('links Atom perigosos como único link', () => {
	it('descarta item cujo único link é enclosure', () => {
		const xml = atom('<link rel="enclosure" href="https://exemplo.test/audio.mp3"/>');

		expect(parseFeed(xml, 'fonte')).toHaveLength(0);
	});
});
