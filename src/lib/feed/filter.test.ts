import { describe, it, expect } from 'vitest';
import { matchesFilter, matchesSourceRules, normalize, splitHighlights } from './filter';
import type { FeedItem, FeedSource } from '../types';

const item = (title: string, summary = ''): FeedItem => ({
	id: '1',
	sourceId: 's',
	title,
	summary,
	url: 'https://example.com',
	publishedAt: '2026-11-09T12:00:00Z',
	thumbnail: null
});

const source = (overrides: Partial<FeedSource> = {}): FeedSource => ({
	id: 'reddit-darktide',
	type: 'reddit',
	name: 'r/Darktide (patch)',
	target: 'Darktide',
	categoryId: 'jogos',
	intervalMinutes: 30,
	enabled: true,
	include: ['patch'],
	exclude: ['promoção'],
	matchMode: 'any',
	...overrides
});

describe('normalize', () => {
	it('remove acentos e caixa', () => {
		expect(normalize('Notícias PROMOÇÃO')).toBe('noticias promocao');
	});
});

describe('matchesFilter', () => {
	it('aceita quando qualquer palavra incluída aparece', () => {
		expect(matchesFilter('Notas do PATCH', ['patch', 'hotfix'], [], 'any')).toBe(true);
	});

	it('exige todas as palavras no modo all', () => {
		expect(matchesFilter('patch de hotfix', ['patch', 'hotfix'], [], 'all')).toBe(true);
		expect(matchesFilter('só patch', ['patch', 'hotfix'], [], 'all')).toBe(false);
	});

	it('exclusão sempre vence', () => {
		expect(matchesFilter('PROMOÇÃO com patch', ['patch'], ['promocao'], 'any')).toBe(false);
	});

	it('ignora acentos nas palavras', () => {
		expect(matchesFilter('Promoção imperdível', [], ['promocao'], 'any')).toBe(false);
	});

	it('sem inclusões aceita por padrão', () => {
		expect(matchesFilter('qualquer coisa', [], [], 'any')).toBe(true);
	});
});

describe('splitHighlights', () => {
	it('destaca o trecho preservando o texto original', () => {
		expect(splitHighlights('Notas do patch mais recente', ['patch'])).toEqual([
			{ text: 'Notas do ', highlight: false },
			{ text: 'patch', highlight: true },
			{ text: ' mais recente', highlight: false }
		]);
	});

	it('destaca ignorando acentos e caixa', () => {
		const segments = splitHighlights('ATUALIZAÇÃO importante', ['atualizacao']);
		expect(segments.filter((segment) => segment.highlight).map((segment) => segment.text)).toEqual([
			'ATUALIZAÇÃO'
		]);
	});
});

describe('matchesSourceRules', () => {
	it('considera título e resumo com as regras da fonte', () => {
		expect(matchesSourceRules(item('Notas', 'traz o patch novo'), source())).toBe(true);
		expect(matchesSourceRules(item('Promoção da semana', 'patch'), source())).toBe(false);
		expect(matchesSourceRules(item('Notícia comum', 'nada aqui'), source())).toBe(false);
	});
});
