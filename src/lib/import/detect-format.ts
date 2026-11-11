import type { FileImportFormat } from './file-import';

/**
 * Descobre o formato pelo nome do arquivo e, se preciso, pelo conteúdo.
 * Assim o usuário não precisa escolher o tipo antes de selecionar o arquivo.
 */
export function detectImportFormat(fileName: string, content: string): FileImportFormat | null {
	const name = fileName.toLowerCase();

	if (name.endsWith('.opml') || name.endsWith('.xml')) return 'opml';
	if (name.endsWith('.html') || name.endsWith('.htm')) return 'bookmarks';

	const head = content.slice(0, 4096).toLowerCase();
	if (head.includes('<opml')) return 'opml';
	if (head.includes('netscape-bookmark') || head.includes('<dl')) return 'bookmarks';

	return null;
}
