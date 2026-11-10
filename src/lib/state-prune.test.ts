import { describe, expect, it } from 'vitest';
import { pruneState } from './state-prune';
import type { HubState } from './types';

const now = new Date('2026-11-10T12:00:00Z');

function state(overrides: Partial<HubState> = {}): HubState {
	return {
		version: 1,
		read: {},
		saved: [],
		savedItems: {},
		...overrides
	};
}

function snapshot(id: string) {
	return {
		item: {
			id,
			sourceId: 'fonte',
			title: id,
			summary: '',
			url: `https://example.com/${id}`,
			publishedAt: '',
			thumbnail: null
		},
		sourceId: 'fonte',
		sourceName: 'Fonte',
		savedAt: '2026-01-01T00:00:00Z'
	};
}

describe('pruneState', () => {
	it('remove leituras antigas e mantém as recentes', () => {
		const result = pruneState(
			state({
				read: {
					antigo: '2026-01-01T00:00:00Z',
					recente: '2026-11-01T00:00:00Z'
				}
			}),
			{ now }
		);

		expect(Object.keys(result.state.read)).toEqual(['recente']);
		expect(result.removedRead).toBe(1);
		expect(result.changed).toBe(true);
	});

	it('nunca remove leitura de post salvo', () => {
		const result = pruneState(
			state({
				read: { antigo: '2025-01-01T00:00:00Z' },
				saved: ['antigo']
			}),
			{ now }
		);

		expect(result.state.read.antigo).toBe('2025-01-01T00:00:00Z');
		expect(result.removedRead).toBe(0);
	});

	it('remove snapshots órfãos e mantém os salvos', () => {
		const result = pruneState(
			state({
				saved: ['vivo'],
				savedItems: { vivo: snapshot('vivo'), orfao: snapshot('orfao') }
			}),
			{ now }
		);

		expect(Object.keys(result.state.savedItems)).toEqual(['vivo']);
		expect(result.removedSnapshots).toBe(1);
	});

	it('é idempotente', () => {
		const first = pruneState(
			state({
				read: { antigo: '2020-01-01T00:00:00Z' },
				saved: ['vivo'],
				savedItems: { vivo: snapshot('vivo'), orfao: snapshot('orfao') }
			}),
			{ now }
		);
		const second = pruneState(first.state, { now });

		expect(second.changed).toBe(false);
		expect(second.state).toEqual(first.state);
	});

	it('registra lastPrunedAt apenas quando algo muda', () => {
		const unchanged = pruneState(state(), { now });
		expect(unchanged.changed).toBe(false);
		expect(unchanged.state.lastPrunedAt).toBeUndefined();

		const changed = pruneState(state({ read: { antigo: '2020-01-01T00:00:00Z' } }), { now });
		expect(changed.state.lastPrunedAt).toBe(now.toISOString());
	});

	it('trata datas inválidas como antigas', () => {
		const result = pruneState(state({ read: { quebrado: 'não é data' } }), { now });
		expect(result.state.read).toEqual({});
	});

	it('respeita retenção configurável', () => {
		const result = pruneState(state({ read: { meio: '2026-11-01T00:00:00Z' } }), {
			now,
			retentionDays: 3
		});
		expect(result.state.read).toEqual({});
	});
});
