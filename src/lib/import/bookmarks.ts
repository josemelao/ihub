import { decodeEntities } from '../feed/parse';
import { toSafeHttpUrl } from '../net/url';
import { addIssue, type ImportIssue } from './issues';

export interface ParsedBookmark {
	title: string;
	url: string;
	folderPath: string[];
}

export interface ParsedBookmarks {
	bookmarks: ParsedBookmark[];
	skipped: number;
	invalid?: ImportIssue[];
}

const MAX_DEPTH = 50;
const MAX_BOOKMARKS = 100_000;
const MAX_TITLE = 500;
const MAX_FOLDER = 120;

const TAG_PATTERN = /<(\/?)(DL|DT|H3|A)\b([^>]*)>/gi;

function cleanText(value: string): string {
	return decodeEntities(value.replace(/<[^>]*>/g, ' '))
		.replace(/\s+/g, ' ')
		.trim();
}

function attr(attrs: string, name: string): string {
	const pattern = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
	const match = pattern.exec(attrs);
	return (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
}

/**
 * Lê o HTML exportado pelos navegadores (formato Netscape Bookmark) em uma
 * única passada. Âncoras sem fechamento são recuperadas na próxima tag e
 * contadas em `skipped`, em vez de consumir o resto do arquivo.
 */
export function parseBookmarksHtml(html: string): ParsedBookmarks {
	const bookmarks: ParsedBookmark[] = [];
	const invalid: ImportIssue[] = [];
	const used = new Set<string>();
	const folderStack: string[] = [];
	const dlStack: boolean[] = [];
	let skipped = 0;
	let pendingFolder: string | null = null;
	let pendingH3 = false;
	let pendingAnchor: { url: string | null; value: string } | null = null;
	let cursor = 0;
	let match: RegExpExecArray | null;

	const finishAnchor = (text: string, closed: boolean): void => {
		if (!pendingAnchor) return;
		const { url, value } = pendingAnchor;
		pendingAnchor = null;

		if (!closed) {
			skipped += 1;
			addIssue(invalid, value, 'tag <A> sem fechamento');
		}
		if (!url) {
			skipped += 1;
			addIssue(invalid, value, 'URL não http(s)');
			return;
		}
		if (used.has(url)) {
			skipped += 1;
			addIssue(invalid, value, 'URL duplicada');
			return;
		}
		if (bookmarks.length >= MAX_BOOKMARKS) {
			skipped += 1;
			addIssue(invalid, value, 'limite de itens');
			return;
		}

		used.add(url);
		bookmarks.push({
			title: cleanText(text).slice(0, MAX_TITLE) || url,
			url,
			folderPath: [...folderStack]
		});
	};

	const finishFolder = (text: string, closed: boolean): void => {
		if (!pendingH3) return;
		pendingH3 = false;
		if (!closed) {
			skipped += 1;
			addIssue(invalid, text, 'tag <H3> sem fechamento');
		}
		pendingFolder = cleanText(text).slice(0, MAX_FOLDER) || null;
	};

	while ((match = TAG_PATTERN.exec(html))) {
		const text = html.slice(cursor, match.index);
		if (pendingH3) finishFolder(text, /^<\/H3/i.test(match[0]));
		if (pendingAnchor) finishAnchor(text, /^<\/A/i.test(match[0]));

		const closing = match[1] === '/';
		const name = match[2].toUpperCase();

		if (name === 'H3' && !closing) {
			pendingH3 = true;
		} else if (name === 'A' && !closing) {
			const raw = decodeEntities(attr(match[3], 'href'));
			pendingAnchor = { url: toSafeHttpUrl(raw), value: raw || '(vazio)' };
		} else if (name === 'DL') {
			if (closing) {
				if (dlStack.pop()) folderStack.pop();
			} else {
				if (folderStack.length >= MAX_DEPTH) {
					dlStack.push(false);
					skipped += 1;
					addIssue(invalid, pendingFolder ?? '', 'profundidade máxima');
				} else {
					const pushed = pendingFolder !== null;
					dlStack.push(pushed);
					if (pushed) folderStack.push(pendingFolder!);
				}
				pendingFolder = null;
			}
		}

		cursor = TAG_PATTERN.lastIndex;
	}

	const tail = html.slice(cursor);
	if (pendingH3) finishFolder(tail, false);
	if (pendingAnchor) finishAnchor(tail, false);

	return { bookmarks, skipped, invalid };
}
