import { decodeEntities } from '../feed/parse';
import { toSafeHttpUrl } from '../net/url';

export interface ParsedBookmark {
	title: string;
	url: string;
	folderPath: string[];
}

export interface ParsedBookmarks {
	bookmarks: ParsedBookmark[];
	skipped: number;
}

function cleanText(value: string): string {
	return decodeEntities(value.replace(/<[^>]*>/g, ' '))
		.replace(/\s+/g, ' ')
		.trim();
}

function attr(attrs: string, name: string): string {
	const match = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attrs);
	return (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
}

/**
 * Lê o HTML exportado pelos navegadores (formato Netscape Bookmark).
 * Pastas aninhadas viram `folderPath`; URLs não http(s) e duplicadas são ignoradas.
 */
export function parseBookmarksHtml(html: string): ParsedBookmarks {
	const tokenPattern =
		/<H3\b[^>]*>([\s\S]*?)<\/H3>|<A\b([^>]*)>([\s\S]*?)<\/A>|<DL\b[^>]*>|<\/DL>/gi;
	const folderStack: string[] = [];
	const dlStack: boolean[] = [];
	const seen = new Set<string>();
	const bookmarks: ParsedBookmark[] = [];
	let pendingFolder: string | null = null;
	let skipped = 0;
	let match: RegExpExecArray | null;

	while ((match = tokenPattern.exec(html))) {
		if (match[1] !== undefined) {
			pendingFolder = cleanText(match[1]);
			continue;
		}

		if (match[2] !== undefined) {
			const url = toSafeHttpUrl(decodeEntities(attr(match[2], 'href')));
			if (!url) {
				skipped += 1;
				continue;
			}
			if (seen.has(url)) {
				skipped += 1;
				continue;
			}
			seen.add(url);
			bookmarks.push({
				title: cleanText(match[3]) || url,
				url,
				folderPath: [...folderStack]
			});
			continue;
		}

		if (match[0].toLowerCase().startsWith('</dl')) {
			if (dlStack.pop()) folderStack.pop();
			continue;
		}

		const pushed = pendingFolder !== null;
		dlStack.push(pushed);
		if (pendingFolder !== null) folderStack.push(pendingFolder);
		pendingFolder = null;
	}

	return { bookmarks, skipped };
}
