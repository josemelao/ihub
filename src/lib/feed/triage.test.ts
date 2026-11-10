import { describe, expect, it } from 'vitest';
import { countUnread, cutoffDaysAgo, idsOlderThan, resolveScope } from './triage';
import type { SavedFilter } from '../types';

function entry(
	id: string,
	options: { read?: boolean; categoryId?: string; sourceId?: string; publishedAt?: string } = {}
) {
	return {
		read: options.read ?? false,
		item: { id, publishedAt: options.publishedAt ?? '2026-11-10T12:00:00Z' },
		source: { id: options.sourceId ?? 'fonte-a', categoryId: options.categoryId ?? 'jogos' }
	};
}

describe('countUnread', () => {
	it('conta apenas não lidos por categoria e fonte', () => {
		const result = countUnread([
			entry('a'),
			entry('b'),
			entry('c', { read: true }),
			entry('d', { categoryId: 'tools', sourceId: 'fonte-b' })
		]);

		expect(result.total).toBe(3);
		expect(result.byCategory).toEqual({ jogos: 2, tools: 1 });
		expect(result.bySource).toEqual({ 'fonte-a': 2, 'fonte-b': 1 });
	});
});

describe('idsOlderThan', () => {
	it('devolve só não lidos anteriores ao corte', () => {
		const ids = idsOlderThan(
			[
				entry('antigo', { publishedAt: '2026-11-01T12:00:00Z' }),
				entry('limite', { publishedAt: '2026-11-03T12:00:00Z' }),
				entry('recente', { publishedAt: '2026-11-10T12:00:00Z' }),
				entry('lido', { read: true, publishedAt: '2026-11-01T12:00:00Z' }),
				entry('sem-data', { publishedAt: '' })
			],
			'2026-11-03T12:00:00Z'
		);

		expect(ids).toEqual(['antigo']);
	});
});

describe('cutoffDaysAgo', () => {
	it('calcula o corte em UTC', () => {
		expect(cutoffDaysAgo(3, new Date('2026-11-10T12:00:00Z'))).toBe('2026-11-07T12:00:00.000Z');
	});
});

describe('resolveScope', () => {
	const toolbar = { categoryId: 'jogos', sourceId: 'fonte-a', unreadOnly: false };

	it('usa a barra quando não há filtro ativo', () => {
		expect(resolveScope(null, toolbar)).toEqual(toolbar);
	});

	it('o escopo do filtro sobrepõe a barra', () => {
		const filter: SavedFilter = {
			id: 'f',
			label: 'Filtro',
			include: ['x'],
			exclude: [],
			matchMode: 'any',
			categoryId: 'tools',
			sourceId: 'fonte-b',
			unreadOnly: true
		};

		expect(resolveScope(filter, toolbar)).toEqual({
			categoryId: 'tools',
			sourceId: 'fonte-b',
			unreadOnly: true
		});
	});

	it('campos ausentes no filtro caem para a barra', () => {
		const filter: SavedFilter = {
			id: 'f',
			label: 'Filtro',
			include: ['x'],
			exclude: [],
			matchMode: 'any'
		};

		expect(resolveScope(filter, { ...toolbar, unreadOnly: true })).toEqual({
			categoryId: 'jogos',
			sourceId: 'fonte-a',
			unreadOnly: true
		});
	});
});
