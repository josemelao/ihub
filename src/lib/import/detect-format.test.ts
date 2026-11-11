import { describe, expect, it } from 'vitest';
import { detectImportFormat } from './detect-format';

describe('detectImportFormat', () => {
	it('detects by extension', () => {
		expect(detectImportFormat('favoritos.html', '')).toBe('bookmarks');
		expect(detectImportFormat('favoritos.HTM', '')).toBe('bookmarks');
		expect(detectImportFormat('feeds.opml', '')).toBe('opml');
		expect(detectImportFormat('feeds.xml', '')).toBe('opml');
	});

	it('detects by content when the extension is unknown', () => {
		expect(detectImportFormat('arquivo', '<opml version="2.0"></opml>')).toBe('opml');
		expect(detectImportFormat('arquivo', '<!DOCTYPE NETSCAPE-Bookmark-file-1>')).toBe('bookmarks');
		expect(detectImportFormat('arquivo', '<DL><p><DT><A HREF="https://x.com">X</A></DL>')).toBe(
			'bookmarks'
		);
	});

	it('returns null for unknown content', () => {
		expect(detectImportFormat('arquivo.csv', 'a,b')).toBeNull();
	});
});
