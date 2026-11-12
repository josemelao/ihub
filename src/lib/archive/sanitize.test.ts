import { describe, expect, it } from 'vitest';
import { buildArchiveDocument, sanitizeArchiveBody } from './sanitize';

describe('sanitização do arquivo', () => {
	it('mantém estrutura e remove scripts/iframes/estilos', () => {
		const { html } = sanitizeArchiveBody(
			'<div><section><p onclick="x()">ok</p><script>alert(1)</script><iframe src="https://e.com"></iframe></section></div>',
			'https://exemplo.com/post/'
		);

		expect(html).toContain('<section>');
		expect(html).not.toContain('script');
		expect(html).not.toContain('iframe');
		expect(html).not.toContain('onclick');
	});

	it('coleta imagens absolutas, promove data-src e ignora srcset/data:', () => {
		const { imageUrls } = sanitizeArchiveBody(
			'<img src="/a.png" srcset="x 2x"><img data-src="b.png"><img src="data:image/png;base64,AA">',
			'https://exemplo.com/post/'
		);

		expect(imageUrls).toEqual(['https://exemplo.com/a.png', 'https://exemplo.com/post/b.png']);
	});

	it('limita a 20 imagens', () => {
		const html = Array.from({ length: 25 }, (_, index) => `<img src="/${index}.png">`).join('');

		expect(sanitizeArchiveBody(html, 'https://e.com/').imageUrls).toHaveLength(20);
	});

	it('documento tem CSS local, links externos e imagens locais', () => {
		const doc = buildArchiveDocument({
			title: 'T',
			url: 'https://e.com/a',
			itemId: 'abc',
			body: '<p>oi</p><img src="https://e.com/a.png">',
			assetMap: new Map([['https://e.com/a.png', 'abc123abc123abcd.png']]),
			generatedAt: '2026-01-01T00:00:00.000Z'
		});

		expect(doc).toContain('href="/archive.css"');
		expect(doc).toContain('/api/archive/abc/assets/abc123abc123abcd.png');
		expect(doc).toContain('target="_blank"');
	});
});
