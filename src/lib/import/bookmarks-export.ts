import type { HubData, LinkItem } from '../types';

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => {
		switch (character) {
			case '&':
				return '&amp;';
			case '<':
				return '&lt;';
			case '>':
				return '&gt;';
			case '"':
				return '&quot;';
			default:
				return '&#39;';
		}
	});
}

function linkLine(item: LinkItem): string {
	return `      <DT><A HREF="${escapeHtml(item.url)}">${escapeHtml(item.name)}</A>`;
}

/**
 * Exporta os links do hub no formato Netscape Bookmark, com a mesma divisão
 * de categoria/grupo usada na importação. Apps ficam de fora.
 */
export function buildBookmarksHtml(hub: HubData): string {
	const lines = [
		'<!DOCTYPE NETSCAPE-Bookmark-file-1>',
		'<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
		'<TITLE>Meu Hub</TITLE>',
		'<H1>Meu Hub</H1>',
		'<DL><p>'
	];

	const categories = [...hub.categories].sort((a, b) => a.order - b.order);
	const links = hub.items.filter((item): item is LinkItem => item.type === 'link');

	for (const category of categories) {
		const direct = links.filter((item) => item.categoryId === category.id && !item.groupId);
		const groups = hub.groups
			.filter((group) => group.categoryId === category.id)
			.sort((a, b) => a.order - b.order);

		const groupBlocks = groups
			.map((group) => {
				const groupLinks = links.filter((item) => item.groupId === group.id);
				if (groupLinks.length === 0) return null;
				return [
					`      <DT><H3>${escapeHtml(group.name)}</H3>`,
					'      <DL><p>',
					...groupLinks.map(linkLine),
					'      </DL><p>'
				].join('\n');
			})
			.filter((block): block is string => block !== null);

		if (direct.length === 0 && groupBlocks.length === 0) continue;

		lines.push(`    <DT><H3>${escapeHtml(category.name)}</H3>`);
		lines.push('    <DL><p>');
		lines.push(...direct.map(linkLine));
		if (groupBlocks.length > 0) lines.push(...groupBlocks);
		lines.push('    </DL><p>');
	}

	lines.push('</DL><p>');
	return `${lines.join('\n')}\n`;
}
