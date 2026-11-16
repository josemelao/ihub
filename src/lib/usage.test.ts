import { describe, expect, it } from 'vitest';
import type { UsageData } from '../types';
import { MAX_USAGE_ENTRIES, mostUsedUsage, recentUsage, recordUsage } from './usage';

const empty: UsageData = { version: 1, entries: {} };

describe('recordUsage', () => {
	it('incrementa a contagem e atualiza a última abertura', () => {
		const first = recordUsage(empty, 'a', '2026-01-01T00:00:00.000Z');
		const second = recordUsage(first, 'a', '2026-01-02T00:00:00.000Z');

		expect(second.entries.a).toEqual({
			id: 'a',
			count: 2,
			lastOpenedAt: '2026-01-02T00:00:00.000Z'
		});
		expect(empty.entries).toEqual({});
	});

	it('limita o histórico aos 500 itens mais recentes', () => {
		let data = empty;
		for (let index = 0; index < MAX_USAGE_ENTRIES + 2; index += 1) {
			data = recordUsage(data, `item-${index}`, new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString());
		}

		expect(Object.keys(data.entries)).toHaveLength(MAX_USAGE_ENTRIES);
		expect(data.entries['item-0']).toBeUndefined();
		expect(data.entries['item-1']).toBeUndefined();
		expect(data.entries[`item-${MAX_USAGE_ENTRIES + 1}`]).toBeDefined();
	});
});

describe('ordenações', () => {
	const usage: UsageData = {
		version: 1,
		entries: {
			a: { id: 'a', count: 5, lastOpenedAt: '2026-01-01T00:00:00.000Z' },
			b: { id: 'b', count: 2, lastOpenedAt: '2026-01-03T00:00:00.000Z' },
			c: { id: 'c', count: 5, lastOpenedAt: '2026-01-02T00:00:00.000Z' }
		}
	};

	it('ordena recentes por última abertura', () => {
		expect(recentUsage(usage, 2).map((entry) => entry.id)).toEqual(['b', 'c']);
	});

	it('ordena mais usados por contagem e desempata pelo mais recente', () => {
		expect(mostUsedUsage(usage, 3).map((entry) => entry.id)).toEqual(['c', 'a', 'b']);
	});
});
