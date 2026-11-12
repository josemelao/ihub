import { parseHTML } from 'linkedom';
import sanitizeHtml from 'sanitize-html';

export const MAX_ARCHIVE_IMAGES = 20;
export const MAX_ARCHIVE_HTML_BYTES = 3_000_000;

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
	'small',
	'div',
	'section',
	'article',
	'header',
	'footer',
	'main',
	'nav',
	'aside',
	'dl',
	'dt',
	'dd',
	'time',
	'details',
	'summary',
	'picture',
	'source',
	'mark',
	's',
	'u',
	'abbr',
	'cite',
	'q'
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

export function sanitizeArchiveBody(
	bodyHtml: string,
	baseUrl: string
): { html: string; imageUrls: string[] } {
	const imageUrls: string[] = [];
	const seen = new Set<string>();

	const html = sanitizeHtml(bodyHtml, {
		allowedTags: ALLOWED_TAGS,
		allowedAttributes: {
			a: ['href', 'title', 'rel', 'target'],
			img: [
				'src',
				'alt',
				'title',
				'width',
				'height',
				'referrerpolicy',
				'loading',
				'data-src',
				'data-original'
			],
			time: ['datetime'],
			details: ['open'],
			abbr: ['title'],
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
					attribs: { ...attribs, href, rel: 'noopener noreferrer', target: '_blank' }
				};
			},
			img: (tagName, attribs) => {
				const candidate = attribs.src ?? attribs['data-src'] ?? attribs['data-original'];
				const src = absoluteHttpUrl(candidate, baseUrl);
				if (!src) return { tagName: 'span', attribs: {} };

				if (!seen.has(src) && imageUrls.length < MAX_ARCHIVE_IMAGES) {
					seen.add(src);
					imageUrls.push(src);
				}

				return {
					tagName,
					attribs: {
						src,
						alt: attribs.alt ?? '',
						...(attribs.title ? { title: attribs.title } : {}),
						...(attribs.width ? { width: attribs.width } : {}),
						...(attribs.height ? { height: attribs.height } : {}),
						referrerpolicy: 'no-referrer',
						loading: 'lazy'
					}
				};
			}
		}
	});

	return { html, imageUrls };
}

export function archiveAssetPath(itemId: string, name: string): string {
	return `/api/archive/${itemId}/assets/${name}`;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

export function buildArchiveDocument(input: {
	title: string;
	url: string;
	itemId: string;
	body: string;
	assetMap: Map<string, string>;
	generatedAt: string;
}): string {
	const { document } = parseHTML(`<html><body>${input.body}</body></html>`);

	for (const image of Array.from(document.querySelectorAll('img'))) {
		const src = image.getAttribute('src') ?? '';
		const asset = input.assetMap.get(src);
		if (!asset) {
			image.remove();
			continue;
		}
		image.setAttribute('src', archiveAssetPath(input.itemId, asset));
	}

	const title = input.title || input.url;
	const body = document.body?.innerHTML ?? '';

	return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="/archive.css">
</head>
<body>
<header class="archive-bar">
	<div class="archive-title"><strong>${escapeHtml(title)}</strong><span>Arquivado em ${escapeHtml(input.generatedAt.slice(0, 10))}</span></div>
	<nav><a href="${escapeHtml(input.url)}" target="_blank" rel="noopener noreferrer">Abrir original</a><a href="/ler/${escapeHtml(input.itemId)}">Voltar ao hub</a></nav>
</header>
<main class="archive-body">
${body}
</main>
</body>
</html>
`;
}
