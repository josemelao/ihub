import { describe, expect, it } from 'vitest';
import { applyStateAction, type StatePayload } from './state-actions';
import type { HubState, SavedItemSnapshot } from './types';

const empty = (): HubState => ({ version: 1, read: {}, saved: [], savedItems: {} });
const now = '2026-11-10T14:00:00.000Z';

const snapshot = (id: string): SavedItemSnapshot => ({
	item: {
		id,
		sourceId: 'fonte',
		title: 'Post salvo',
		summary: '',
		url: 'https://example.com/post',
		publishedAt: '2026-11-09T12:00:00Z',
		thumbnail: null
	},
	sourceId: 'fonte',
	sourceName: 'Fonte',
	savedAt: ''
});

describe('applyStateAction', () => {
	it('marca e desmarca leitura', () => {
		const read = applyStateAction(empty(), { action: 'read', id: 'a' }, now);
		expect(read.ok).toBe(true);
		if (!read.ok) return;
		expect(read.state.read.a).toBe(now);

		const unread = applyStateAction(read.state, { action: 'unread', id: 'a' }, now);
		expect(unread.ok).toBe(true);
		if (!unread.ok) return;
		expect(unread.state.read.a).toBeUndefined();
	});

	it('salva com snapshot e unsave remove os dois', () => {
		const saved = applyStateAction(
			empty(),
			{ action: 'save', id: 'a', snapshot: snapshot('a') },
			now
		);
		expect(saved.ok).toBe(true);
		if (!saved.ok) return;
		expect(saved.state.saved).toEqual(['a']);
		expect(saved.state.savedItems.a.savedAt).toBe(now);

		const removed = applyStateAction(saved.state, { action: 'unsave', id: 'a' }, now);
		expect(removed.ok).toBe(true);
		if (!removed.ok) return;
		expect(removed.state.saved).toEqual([]);
		expect(removed.state.savedItems.a).toBeUndefined();
	});

	it('rejeita snapshot com URL insegura', () => {
		const unsafe = snapshot('a');
		unsafe.item.url = 'javascript:alert(1)';

		const result = applyStateAction(empty(), { action: 'save', id: 'a', snapshot: unsafe }, now);
		expect(result).toEqual({
			ok: false,
			error: 'Snapshot inválido: item, URL ou thumbnail não são seguros.'
		});
	});

	it('marca e desmarca vários ids', () => {
		const read = applyStateAction(empty(), { action: 'mark-all-read', ids: ['a', 'b'] }, now);
		expect(read.ok).toBe(true);
		if (!read.ok) return;
		expect(read.state.read).toEqual({ a: now, b: now });

		const unread = applyStateAction(read.state, { action: 'mark-unread', ids: ['a'] }, now);
		expect(unread.ok).toBe(true);
		if (!unread.ok) return;
		expect(unread.state.read).toEqual({ b: now });
	});

	it('rejeita ação e payload inválidos', () => {
		expect(applyStateAction(empty(), { action: 'x' } as unknown as StatePayload, now)).toEqual({
			ok: false,
			error: 'Ação inválida.'
		});
		expect(applyStateAction(empty(), { action: 'read' }, now)).toEqual({
			ok: false,
			error: 'Informe o id do post.'
		});
		expect(applyStateAction(empty(), { action: 'mark-all-read' }, now)).toEqual({
			ok: false,
			error: 'Envie a lista de ids.'
		});
	});

	it('ignora ids não-string em mark-all-read', () => {
		const result = applyStateAction(
			empty(),
			{ action: 'mark-all-read', ids: ['a', 2 as unknown as string] },
			now
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(Object.keys(result.state.read)).toEqual(['a']);
	});
});
