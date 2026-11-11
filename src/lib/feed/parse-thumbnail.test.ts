import { describe, expect, it } from 'vitest';
import { parseFeed } from './parse';

const rss = (item: string) => `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item>
    <title>Episódio</title>
    <link>https://exemplo.test/ep</link>
    ${item}
  </item>
</channel></rss>`;

describe('parseFeed thumbnail só de imagem', () => {
	it('não usa enclosure de áudio como thumbnail', () => {
		const xml = rss(`
      <enclosure type="audio/mpeg" url="https://exemplo.test/ep.mp3"/>
      <description><![CDATA[<img src="https://exemplo.test/capa.jpg" />]]></description>
    `);

		expect(parseFeed(xml, 'fonte')[0]?.thumbnail).toBe('https://exemplo.test/capa.jpg');
	});

	it('aceita enclosure com type de imagem', () => {
		const xml = rss('<enclosure type="image/jpeg" url="https://exemplo.test/capa"/>');

		expect(parseFeed(xml, 'fonte')[0]?.thumbnail).toBe('https://exemplo.test/capa');
	});

	it('aceita media:thumbnail sem type', () => {
		const xml = rss('<media:thumbnail url="https://exemplo.test/thumb"/>');

		expect(parseFeed(xml, 'fonte')[0]?.thumbnail).toBe('https://exemplo.test/thumb');
	});

	it('ignora media:content de vídeo', () => {
		const xml = rss('<media:content type="video/mp4" url="https://exemplo.test/video.mp4"/>');

		expect(parseFeed(xml, 'fonte')[0]?.thumbnail).toBeNull();
	});

	it('usa URL com extensão de imagem quando não há type', () => {
		const xml = rss('<media:content url="https://exemplo.test/foto.png"/>');

		expect(parseFeed(xml, 'fonte')[0]?.thumbnail).toBe('https://exemplo.test/foto.png');
	});

	it('ignora URL de áudio sem type', () => {
		const xml = rss('<media:content url="https://exemplo.test/audio.mp3"/>');

		expect(parseFeed(xml, 'fonte')[0]?.thumbnail).toBeNull();
	});
});
