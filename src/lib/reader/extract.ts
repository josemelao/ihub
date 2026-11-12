import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import sanitizeHtml from 'sanitize-html';

export type ReaderErrorCode = 'no-content' | 'too-large' | 'invalid-url';

export class ReaderError extends Error {
	readonly code: ReaderErrorCode;

	constructor(message: string, code: ReaderErrorCode) {
		super(message);
		this.name = 'ReaderError';
		this.code = code;
	}
}

export interface ExtractedArticle {
	title: string;
	byline: string;
	siteName: string;
	excerpt: string;
	length: number;
	html: string;
	text: string;
}

export const MAX_ARTICLE_HTML_BYTES = 2_000_000;
export const MAX_ARTICLE_TEXT_CHARS = 200_000;

const ALLOWED_TAGS = [
	'p',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'a',
	'ul',
	'ol',
	'li',
	'blockquote',
	'pre',
	'code',
	'em',
	'strong',
	'b',
	'i',
	'hr',
	'br',
	'figure',
	'figcaption',
	'img',
	'table',
	'thead',
	'tbody',
	'tr',
	'th',
	'td',
	'sup',
	'sub',
	'small'
];

function absoluteHttpUrl(value: string | undefined, baseUrl: string): string | null {
	if (!value) return null;
	try {
		const url = new URL(value, baseUrl);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
		return url.toString();
	} catch {
		return null;
	}
}

export function sanitizeArticleHtml(html: string, baseUrl: string): string {
	const sanitized = sanitizeHtml(html, {
		allowedTags: ALLOWED_TAGS,
		allowedAttributes: {
			a: ['href', 'title', 'rel', 'target'],
			img: ['src', 'alt', 'title', 'width', 'height', 'referrerpolicy', 'loading'],
			th: ['colspan', 'rowspan'],
			td: ['colspan', 'rowspan']
		},
		allowedSchemes: ['http', 'https'],
		disallowedTagsMode: 'discard',
		transformTags: {
			a: (tagName, attribs) => {
				const href = absoluteHttpUrl(attribs.href, baseUrl);
				if (!href) return { tagName: 'span', attribs: {} };
				return {
					tagName,
					attribs: {
						...attribs,
						href,
						rel: 'noopener noreferrer',
						target: '_blank'
					}
				};
			},
			img: (tagName, attribs) => {
				const src = absoluteHttpUrl(attribs.src, baseUrl);
				if (!src) return { tagName: 'span', attribs: {} };
				return {
					tagName,
					attribs: {
						...attribs,
						src,
						referrerpolicy: 'no-referrer',
						loading: 'lazy'
					}
				};
			}
		}
	});

	if (Buffer.byteLength(sanitized, 'utf8') > MAX_ARTICLE_HTML_BYTES) {
		throw new ReaderError('Artigo grande demais para o cache local.', 'too-large');
	}

	return sanitized;
}

function htmlToText(html: string): string {
	const { document } = parseHTML(`<html><body>${html}</body></html>`);
	return (document.body?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function extractReadable(html: string, finalUrl: string): ExtractedArticle {
	let parsed: ReturnType<Readability['parse']> = null;
	try {
		const { document } = parseHTML(html);
		parsed = new Readability(document, { charThreshold: 250 }).parse();
	} catch {
		parsed = null;
	}

	if (!parsed?.content) {
		throw new ReaderError('Não foi possível extrair o conteúdo principal.', 'no-content');
	}

	const sanitized = sanitizeArticleHtml(parsed.content, finalUrl);
	const fullText = htmlToText(sanitized);
	if (fullText.length < 80) {
		throw new ReaderError('Não foi possível extrair o conteúdo principal.', 'no-content');
	}

	return {
		title: (parsed.title ?? '').trim(),
		byline: (parsed.byline ?? '').trim(),
		siteName: (parsed.siteName ?? '').trim(),
		excerpt: (parsed.excerpt ?? '').trim(),
		length: fullText.length,
		html: sanitized,
		text: fullText.slice(0, MAX_ARTICLE_TEXT_CHARS)
	};
}
