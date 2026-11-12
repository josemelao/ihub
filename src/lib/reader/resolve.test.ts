import { describe, expect, it } from 'vitest';
import { resolveReaderItem } from './resolve';
import type { FeedItem, ReadingArticle, SavedItemSnapshot } from '../types';

const item: FeedItem = {
	id: 'abc',
	sourceId: 's',
	title: 'Post',
	summary: 'resumo',
	url: 'https://e.com/a',
	publishedAt: '',
	thumbnail: null
};

const snapshot = {
	item,
	sourceId: 's',
	sourceName: 'S',
	savedAt: '2026-01-01T00:00:00.000Z'
} as SavedItemSnapshot;

const article: ReadingArticle = {
	id: 'abc',
	url: 'https://e.com/a',
	finalUrl: 'https://e.com/a',
	title: 'Artigo',
	byline: '',
	siteName: '',
	excerpt: 'trecho',
	publishedAt: '',
	fetchedAt: '',
	length: 1,
	html: '<p>x</p>',
	text: 'x'
};

describe('resolveReaderItem', () => {
	it('prefere o item do feed', () => {
		expect(resolveReaderItem(item, snapshot, article)?.sourceId).toBe('s');
	});

	it('cai no snapshot quando o feed não tem o item', () => {
		expect(resolveReaderItem(undefined, snapshot, null)?.title).toBe('Post');
	});

	it('cai no artigo quando só ele existe', () => {
		expect(resolveReaderItem(undefined, undefined, article)?.title).toBe('Artigo');
	});

	it('devolve null quando nada existe', () => {
		expect(resolveReaderItem(undefined, undefined, null)).toBeNull();
	});
});
