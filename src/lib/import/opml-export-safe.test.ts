import { describe, expect, it } from 'vitest';
import { buildOpml } from './opml';
import type { FeedSource, HubData } from '../types';

const source = (overrides: Partial<FeedSource>): FeedSource => ({
	id: 'fonte',
	type: 'rss',
	name: 'Fonte',
	target: 'https://exemplo.test/feed.xml',
	categoryId: 'jogos',
	intervalMinutes: 30,
	enabled: true,
	include: [],
	exclude: [],
	matchMode: 'any',
	...overrides
});

const hub = (sources: FeedSource[]): HubData => ({
	version: 1,
	settings: { accent: '#8AA4FF' },
	categories: [{ id: 'jogos', name: 'Jogos', color: '#8AA4FF', order: 1 }],
	groups: [],
	items: [],
	feedSources: sources,
	savedFilters: []
});

describe('buildOpml valida as URLs de feed', () => {
	it('omite fonte RSS com javascript: no target', () => {
		const xml = buildOpml(hub([source({ target: 'javascript:alert(1)' })]));

		expect(xml).not.toContain('javascript:');
		expect(xml).not.toContain('xmlUrl');
	});

	it('omite fonte RSS com file://', () => {
		const xml = buildOpml(hub([source({ target: 'file:///C:/Windows/win.ini' })]));

		expect(xml).not.toContain('file://');
	});

	it('omite YouTube com target perigoso contendo feeds/videos.xml', () => {
		const xml = buildOpml(
			hub([source({ type: 'youtube', target: 'javascript:alert(feeds/videos.xml)' })])
		);

		expect(xml).not.toContain('javascript:');
	});

	it('exporta as fontes seguras normalmente', () => {
		const xml = buildOpml(hub([source({})]));

		expect(xml).toContain('xmlUrl="https://exemplo.test/feed.xml"');
	});
});
