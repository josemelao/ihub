import { describe, expect, it } from 'vitest';
import { parseBookmarksHtml } from './bookmarks';

const NESTED = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
  <DT><H3 ADD_DATE="1">Jogos</H3>
  <DL><p>
    <DT><H3>Darktide</H3>
    <DL><p>
      <DT><A HREF="https://example.com/builds?a=1&amp;b=2" ADD_DATE="2">Builds &amp; guias</A>
      <DT><A HREF="https://example.com/wiki">Wiki</A>
    </DL><p>
    <DT><A HREF="https://example.com/patch">Patch notes</A>
  </DL><p>
  <DT><A HREF="https://example.com/root">Raiz</A>
</DL><p>`;

describe('parseBookmarksHtml', () => {
	it('maps nested folders to folderPath', () => {
		const { bookmarks } = parseBookmarksHtml(NESTED);

		expect(bookmarks).toContainEqual({
			title: 'Builds & guias',
			url: 'https://example.com/builds?a=1&b=2',
			folderPath: ['Jogos', 'Darktide']
		});
		expect(bookmarks).toContainEqual({
			title: 'Wiki',
			url: 'https://example.com/wiki',
			folderPath: ['Jogos', 'Darktide']
		});
		expect(bookmarks).toContainEqual({
			title: 'Patch notes',
			url: 'https://example.com/patch',
			folderPath: ['Jogos']
		});
	});

	it('keeps root bookmarks with an empty folderPath', () => {
		const { bookmarks } = parseBookmarksHtml(NESTED);
		expect(bookmarks).toContainEqual({
			title: 'Raiz',
			url: 'https://example.com/root',
			folderPath: []
		});
	});

	it('decodes HTML entities in folder names and titles', () => {
		const html = `<DL><p>
			<DT><H3>Notícias &amp; afins</H3>
			<DL><p>
				<DT><A HREF="https://example.com/a">Caf&#233; &quot;da tarde&quot;</A>
			</DL><p>
		</DL><p>`;
		const { bookmarks } = parseBookmarksHtml(html);

		expect(bookmarks[0].folderPath).toEqual(['Notícias & afins']);
		expect(bookmarks[0].title).toBe('Café "da tarde"');
	});

	it('skips unsafe, place and empty URLs', () => {
		const html = `<DL><p>
			<DT><A HREF="javascript:alert(1)">Bookmarklet</A>
			<DT><A HREF="place:sort=8">Pasta especial</A>
			<DT><A HREF="file:///C:/segredo.txt">Arquivo</A>
			<DT><A HREF="">Vazio</A>
			<DT><A HREF="https://example.com/ok">Ok</A>
		</DL><p>`;
		const { bookmarks, skipped } = parseBookmarksHtml(html);

		expect(bookmarks).toHaveLength(1);
		expect(bookmarks[0].url).toBe('https://example.com/ok');
		expect(skipped).toBe(4);
	});

	it('deduplicates repeated URLs', () => {
		const html = `<DL><p>
			<DT><A HREF="https://example.com/a">Primeiro</A>
			<DT><A HREF="https://example.com/a">Segundo</A>
		</DL><p>`;
		const { bookmarks, skipped } = parseBookmarksHtml(html);

		expect(bookmarks).toHaveLength(1);
		expect(bookmarks[0].title).toBe('Primeiro');
		expect(skipped).toBe(1);
	});

	it('falls back to the URL when the title is empty', () => {
		const html = `<DL><p><DT><A HREF="https://example.com/sem-titulo">   </A></DL><p>`;
		const { bookmarks } = parseBookmarksHtml(html);

		expect(bookmarks[0].title).toBe('https://example.com/sem-titulo');
	});

	it('returns an empty result for non-bookmark HTML', () => {
		expect(parseBookmarksHtml('<html><body>nada</body></html>')).toEqual({
			bookmarks: [],
			skipped: 0,
			invalid: []
		});
	});

	it('recovers from unclosed anchor tags', () => {
		const html = `<DL><p>
			<DT><A HREF="https://example.com/a">Sem fechar
			<DT><A HREF="https://example.com/b">B</A>
		</DL><p>`;
		const { bookmarks, skipped } = parseBookmarksHtml(html);

		expect(bookmarks.map((bookmark) => bookmark.url)).toEqual([
			'https://example.com/a',
			'https://example.com/b'
		]);
		expect(skipped).toBe(1);
	});

	it('caps folder depth and reports it', () => {
		let html = '<DL><p>';
		for (let index = 0; index < 60; index += 1) {
			html += `<DT><H3>N${index}</H3><DL><p>`;
		}
		html += '<DT><A HREF="https://example.com/deep">Deep</A>';
		html += '</DL><p>'.repeat(61);

		const { bookmarks, skipped, invalid } = parseBookmarksHtml(html);

		expect(bookmarks).toHaveLength(1);
		expect(bookmarks[0].folderPath).toHaveLength(50);
		expect(skipped).toBeGreaterThan(0);
		expect(invalid?.some((issue) => issue.reason.includes('profundidade'))).toBe(true);
	});

	it('lists invalid entries with reasons', () => {
		const html = `<DL><p>
			<DT><A HREF="javascript:alert(1)">Ruim</A>
			<DT><A HREF="https://example.com/a">A</A>
			<DT><A HREF="https://example.com/a">A repetido</A>
		</DL><p>`;
		const { invalid } = parseBookmarksHtml(html);

		expect(invalid?.map((issue) => issue.reason)).toEqual(
			expect.arrayContaining(['URL não http(s)', 'URL duplicada'])
		);
	});

	it('parses many unclosed anchors in linear time', () => {
		const html = `<DL><p>${Array.from(
			{ length: 20_000 },
			(_, index) => `<DT><A HREF="https://example.com/${index}">Item ${index}`
		).join('\n')}`;

		const started = performance.now();
		const { bookmarks, skipped } = parseBookmarksHtml(html);
		const elapsed = performance.now() - started;

		expect(bookmarks).toHaveLength(20_000);
		expect(skipped).toBe(20_000);
		expect(elapsed).toBeLessThan(1000);
	});
});
