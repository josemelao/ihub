import { describe, expect, it } from 'vitest';
import { EMPTY_HUB } from '../defaults';
import { feedUrlFor } from '../feed/sources';
import type { FeedSource, HubData } from '../types';
import { buildOpml, inferSourceType, parseOpml } from './opml';

function source(
	overrides: Partial<FeedSource> & Pick<FeedSource, 'id' | 'type' | 'target'>
): FeedSource {
	return {
		name: overrides.id,
		categoryId: 'jogos',
		intervalMinutes: 30,
		enabled: true,
		include: [],
		exclude: [],
		matchMode: 'any',
		...overrides
	};
}

const hub: HubData = {
	...structuredClone(EMPTY_HUB),
	categories: [
		{ id: 'jogos', name: 'Jogos & Cia', color: '#8AA4FF', order: 1 },
		{ id: 'noticias', name: 'Notícias', color: '#7DD3A8', order: 2 }
	],
	groups: [{ id: 'darktide', categoryId: 'jogos', name: 'Darktide', order: 1 }],
	feedSources: [
		source({
			id: 'reddit',
			type: 'reddit',
			name: 'r/Darktide & cia',
			target: 'Darktide',
			groupId: 'darktide'
		}),
		source({
			id: 'canal',
			type: 'youtube',
			name: 'Canal <Dev>',
			target: 'UCabcdefghijklmnopqrstu'
		}),
		source({ id: 'raiz', type: 'rss', name: 'Raiz', target: 'https://example.com/feed.xml' })
	]
};

const NESTED = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Feeds</title></head>
  <body>
    <outline text="Jogos">
      <outline text="Darktide">
        <outline type="rss" text="r/Darktide" xmlUrl="https://www.reddit.com/r/Darktide/.rss"/>
      </outline>
      <outline type="rss" text="Steam News" xmlUrl="https://store.steampowered.com/feeds/news.xml"/>
    </outline>
    <outline type="rss" title="Notícias" xmlUrl="https://example.com/feed.xml"/>
  </body>
</opml>`;

describe('parseOpml', () => {
	it('reads nested outlines and folder paths', () => {
		const { sources } = parseOpml(NESTED);

		expect(sources).toContainEqual({
			name: 'r/Darktide',
			feedUrl: 'https://www.reddit.com/r/Darktide/.rss',
			folderPath: ['Jogos', 'Darktide']
		});
		expect(sources).toContainEqual({
			name: 'Steam News',
			feedUrl: 'https://store.steampowered.com/feeds/news.xml',
			folderPath: ['Jogos']
		});
		expect(sources).toContainEqual({
			name: 'Notícias',
			feedUrl: 'https://example.com/feed.xml',
			folderPath: []
		});
	});

	it('accepts a single outline object at the root', () => {
		const xml = `<opml><body><outline text="Único" xmlUrl="https://example.com/a.xml"/></body></opml>`;
		expect(parseOpml(xml).sources).toEqual([
			{ name: 'Único', feedUrl: 'https://example.com/a.xml', folderPath: [] }
		]);
	});

	it('accepts url as the feed attribute', () => {
		const xml = `<opml><body><outline text="Sem xmlUrl" url="https://example.com/b.xml"/></body></opml>`;
		expect(parseOpml(xml).sources[0].feedUrl).toBe('https://example.com/b.xml');
	});

	it('skips unsafe or empty feed URLs', () => {
		const xml = `<opml><body>
			<outline text="ftp" xmlUrl="ftp://example.com/a.xml"/>
			<outline text="js" xmlUrl="javascript:alert(1)"/>
			<outline text="vazio" xmlUrl=""/>
			<outline text="ok" xmlUrl="https://example.com/ok.xml"/>
		</body></opml>`;
		const result = parseOpml(xml);

		expect(result.sources).toHaveLength(1);
		expect(result.sources[0].feedUrl).toBe('https://example.com/ok.xml');
		expect(result.skipped).toBe(3);
		expect(result.invalid?.every((issue) => issue.reason.includes('URL'))).toBe(true);
	});

	it('deduplicates repeated feeds', () => {
		const xml = `<opml><body>
			<outline text="A" xmlUrl="https://example.com/a.xml"/>
			<outline text="B" xmlUrl="https://example.com/a.xml"/>
		</body></opml>`;
		const result = parseOpml(xml);

		expect(result.sources).toHaveLength(1);
		expect(result.skipped).toBe(1);
	});

	it('reports invalid XML instead of silently returning empty', () => {
		const result = parseOpml('isto não é xml');

		expect(result.sources).toEqual([]);
		expect(result.skipped).toBe(1);
		expect(result.invalid?.[0]?.reason).toContain('inválido');
	});

	it('caps deep nesting and reports it', () => {
		let xml = '<opml><body>';
		for (let index = 0; index < 60; index += 1) {
			xml += `<outline text="N${index}">`;
		}
		xml += '<outline text="Feed" xmlUrl="https://example.com/feed.xml"/>';
		xml += '</outline>'.repeat(60);
		xml += '</body></opml>';

		const result = parseOpml(xml);

		expect(result.sources).toHaveLength(1);
		expect(result.sources[0].folderPath.length).toBeLessThanOrEqual(50);
		expect(result.skipped).toBeGreaterThan(0);
		expect(result.invalid?.some((issue) => issue.reason.includes('profundidade'))).toBe(true);
	});
});

describe('inferSourceType', () => {
	it('recognizes YouTube and Reddit feeds', () => {
		expect(
			inferSourceType('https://www.youtube.com/feeds/videos.xml?channel_id=UCabcdefghijklmnopqrstu')
		).toBe('youtube');
		expect(inferSourceType('https://www.reddit.com/r/Darktide/.rss')).toBe('reddit');
		expect(inferSourceType('https://example.com/feed.xml')).toBe('rss');
		expect(inferSourceType('not-a-url')).toBe('rss');
	});
});

describe('buildOpml', () => {
	it('round-trips names, feed URLs and folder paths', () => {
		const xml = buildOpml(hub);
		const { sources } = parseOpml(xml);

		const expected = hub.feedSources
			.map((entry) => ({
				name: entry.name,
				feedUrl: feedUrlFor(entry),
				folderPath: entry.groupId === 'darktide' ? ['Jogos & Cia', 'Darktide'] : ['Jogos & Cia']
			}))
			.sort((a, b) => a.name.localeCompare(b.name));
		const actual = sources
			.map((entry) => ({
				name: entry.name,
				feedUrl: entry.feedUrl,
				folderPath: entry.folderPath
			}))
			.sort((a, b) => a.name.localeCompare(b.name));

		expect(actual).toEqual(expected);
	});

	it('escapes XML special characters', () => {
		const xml = buildOpml(hub);

		expect(xml).toContain('Jogos &amp; Cia');
		expect(xml).toContain('Canal &lt;Dev&gt;');
		expect(xml).toContain('r/Darktide &amp; cia');
	});

	it('skips sources without a resolvable feed URL', () => {
		const withHandle: HubData = {
			...structuredClone(EMPTY_HUB),
			categories: [{ id: 'jogos', name: 'Jogos', color: '#8AA4FF', order: 1 }],
			feedSources: [
				source({ id: 'handle', type: 'youtube', target: '@canal', categoryId: 'jogos' }),
				source({ id: 'ok', type: 'rss', target: 'https://example.com/ok.xml', categoryId: 'jogos' })
			]
		};

		const { sources } = parseOpml(buildOpml(withHandle));
		expect(sources).toHaveLength(1);
		expect(sources[0].feedUrl).toBe('https://example.com/ok.xml');
	});
});
