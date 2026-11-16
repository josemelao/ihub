import { describe, expect, it } from 'vitest';
import type { ArchiveIndex, HighlightsData, HubState } from '../types';
import type { SavedContentIndex } from './content-index';
import { buildReadingStats, countWords, estimateReadingMinutes } from './stats';

function state(saved: string[], read: string[] = []): HubState {
	return {
		version: 1,
		read: Object.fromEntries(read.map((id) => [id, '2026-01-03T00:00:00.000Z'])),
		saved,
		savedItems: {}
	};
}

function index(docs: { itemId: string; text: string }[]): SavedContentIndex {
	return {
		savedCount: docs.length,
		savedWithText: docs.filter((doc) => doc.text.trim()).length,
		docs: docs.map((doc) => ({
			itemId: doc.itemId,
			title: `Título ${doc.itemId}`,
			url: `https://e.com/${doc.itemId}`,
			sourceName: 'Fonte',
			text: doc.text
		}))
	};
}

function archive(entries: ArchiveIndex['entries']): ArchiveIndex {
	return { version: 1, entries };
}

function highlights(items: string[]): HighlightsData {
	return {
		version: 1,
		highlights: items.map((itemId, i) => ({
			id: `hl-${i}`,
			itemId,
			itemTitle: `Título ${itemId}`,
			itemUrl: `https://e.com/${itemId}`,
			quote: 'trecho',
			color: 'yellow',
			occurrence: 0,
			createdAt: '2026-01-01T00:00:00.000Z',
			updatedAt: '2026-01-01T00:00:00.000Z'
		}))
	};
}

function archiveEntry(id: string, status: ArchiveIndex['entries'][string]['status']) {
	return {
		id,
		status,
		title: `Título ${id}`,
		url: `https://e.com/${id}`,
		bytes: 100,
		assets: 0,
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z'
	};
}

describe('countWords', () => {
	it('conta palavras separadas por qualquer espaço', () => {
		expect(countWords('  um  dois\n três ')).toBe(3);
	});

	it('devolve zero para texto vazio', () => {
		expect(countWords('   \n ')).toBe(0);
	});
});

describe('estimateReadingMinutes', () => {
	it('devolve zero sem palavras', () => {
		expect(estimateReadingMinutes(0)).toBe(0);
	});

	it('arredonda para cima a 200 palavras por minuto', () => {
		expect(estimateReadingMinutes(1)).toBe(1);
		expect(estimateReadingMinutes(200)).toBe(1);
		expect(estimateReadingMinutes(201)).toBe(2);
	});
});

describe('buildReadingStats', () => {
	it('conta salvos, lidos, arquivados, destaques e tempo só do conjunto salvo', () => {
		const stats = buildReadingStats({
			index: index([
				{ itemId: 'a', text: 'palavra '.repeat(100) },
				{ itemId: 'b', text: 'palavra '.repeat(120) },
				{ itemId: 'c', text: '' }
			]),
			state: state(['a', 'b', 'c'], ['a', 'fora']),
			highlights: highlights(['a', 'c', 'fora']),
			archive: archive({
				a: archiveEntry('a', 'ready'),
				b: archiveEntry('b', 'failed'),
				c: archiveEntry('c', 'pending'),
				fora: archiveEntry('fora', 'ready')
			})
		});

		expect(stats).toEqual({
			saved: 3,
			read: 1,
			archived: 1,
			highlights: 2,
			words: 220,
			minutes: 2,
			withText: 2
		});
	});

	it('zera tudo quando não há salvos', () => {
		const stats = buildReadingStats({
			index: index([]),
			state: state([], ['a']),
			highlights: highlights(['a']),
			archive: archive({ a: archiveEntry('a', 'ready') })
		});

		expect(stats).toEqual({
			saved: 0,
			read: 0,
			archived: 0,
			highlights: 0,
			words: 0,
			minutes: 0,
			withText: 0
		});
	});

	it('conta salvo sem documento no índice, mas não como texto disponível', () => {
		const stats = buildReadingStats({
			index: index([{ itemId: 'a', text: 'uma palavra' }]),
			state: state(['a', 'sem-doc']),
			highlights: highlights([]),
			archive: archive({})
		});

		expect(stats.saved).toBe(2);
		expect(stats.withText).toBe(1);
		expect(stats.words).toBe(2);
	});
});
