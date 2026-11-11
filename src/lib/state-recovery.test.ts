import { describe, it, expect } from 'vitest';
import { recoverHubState } from './state-recovery';
import { HubValidationError, parseHubState } from './schema';
import type { FeedItem } from './types';

const item = (id: string): FeedItem => ({
	id,
	sourceId: 'fonte',
	title: `Post ${id}`,
	summary: '',
	url: 'https://example.com/post',
	publishedAt: '',
	thumbnail: null
});

const snapshot = (id: string) => ({
	item: item(id),
	sourceId: 'fonte',
	sourceName: 'Fonte',
	savedAt: '2026-01-01T00:00:00.000Z'
});

const validState = () => ({
	version: 1,
	read: { a: '2026-01-01T00:00:00.000Z', b: '2026-01-02T00:00:00.000Z' },
	saved: ['a', 'b'],
	savedItems: { a: snapshot('a'), b: snapshot('b') }
});

describe('recoverHubState', () => {
	it('keeps the valid snapshots when one is broken', () => {
		const input = validState();
		(input.savedItems as Record<string, unknown>).b = { sourceId: 'fonte' };

		const { state, recovery } = recoverHubState(input);

		expect(Object.keys(state.savedItems)).toEqual(['a']);
		expect(recovery.removedSnapshots).toBe(1);
		expect(state.read).toEqual(input.read);
	});

	it('drops snapshots whose key does not match the item id', () => {
		const input = validState();
		(input.savedItems as Record<string, unknown>).b = snapshot('outro');

		const { state, recovery } = recoverHubState(input);

		expect(Object.keys(state.savedItems)).toEqual(['a']);
		expect(recovery.removedSnapshots).toBe(1);
	});

	it('drops read entries that are not strings and keeps the rest', () => {
		const input = validState();
		(input.read as Record<string, unknown>).b = 42;

		const { state, recovery } = recoverHubState(input);

		expect(state.read).toEqual({ a: '2026-01-01T00:00:00.000Z' });
		expect(recovery.removedRead).toBe(1);
		expect(state.saved).toEqual(['a', 'b']);
	});

	it('drops saved ids that are not strings', () => {
		const input = validState();
		(input.saved as unknown[]).push(7);

		const { state, recovery } = recoverHubState(input);

		expect(state.saved).toEqual(['a', 'b']);
		expect(recovery.removedSaved).toBe(1);
	});

	it('keeps saved ids that have no snapshot', () => {
		const input = validState();
		input.saved.push('sem-snapshot');

		const { state, recovery } = recoverHubState(input);

		expect(state.saved).toContain('sem-snapshot');
		expect(recovery.removedSnapshots).toBe(0);
	});

	it('always returns a state that parseHubState accepts', () => {
		const input = validState();
		(input.read as Record<string, unknown>).b = null;
		(input.savedItems as Record<string, unknown>).a = { nope: true };

		const { state } = recoverHubState(input);

		expect(() => parseHubState(state)).not.toThrow();
	});

	it('rejects input that is not an object at all', () => {
		expect(() => recoverHubState('nada')).toThrow(HubValidationError);
		expect(() => recoverHubState(null)).toThrow(HubValidationError);
	});

	it('rejects a state whose top-level collections have the wrong type', () => {
		expect(() => recoverHubState({ version: 1, read: [], saved: [], savedItems: {} })).toThrow(
			HubValidationError
		);
		expect(() => recoverHubState({ version: 1, read: {}, saved: 'a', savedItems: {} })).toThrow(
			HubValidationError
		);
	});

	it('reports no recovery when the state is already valid', () => {
		const { recovery } = recoverHubState(validState());

		expect(recovery).toEqual({ removedSnapshots: 0, removedRead: 0, removedSaved: 0 });
	});
});
