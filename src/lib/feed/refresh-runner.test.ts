import { describe, expect, it, vi } from 'vitest';
import { createRefreshRunner } from './refresh-runner';
import type { FeedCache, HubData } from '../types';
import type { RefreshOutcome } from './refresh';

const hub: HubData = {
	version: 1,
	settings: { accent: '#8AA4FF' },
	categories: [],
	groups: [],
	items: [],
	feedSources: [],
	savedFilters: []
};

const cache = (): FeedCache => ({
	version: 1,
	updatedAt: '2026-11-10T12:00:00Z',
	items: [],
	sources: {}
});

const sleep = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<T>((onResolve, onReject) => {
		resolve = onResolve;
		reject = onReject;
	});
	return { promise, resolve, reject };
}

function setup() {
	const outcome = (tag: string): RefreshOutcome => ({
		cache: { ...cache(), updatedAt: tag },
		results: []
	});

	const gate = deferred<void>();
	const calls: string[] = [];
	const refresh = vi.fn(
		async (_hub: HubData, _cache: FeedCache, options: { force: boolean; sourceId?: string }) => {
			calls.push(options.sourceId ?? 'global');
			await gate.promise;
			return outcome(options.sourceId ?? 'global');
		}
	);
	const updateFeedCache = vi.fn(async (fn: (current: FeedCache) => Promise<FeedCache>) =>
		fn(cache())
	);

	const runner = createRefreshRunner({
		loadHub: async () => hub,
		refresh,
		updateFeedCache
	});

	return { runner, refresh, updateFeedCache, gate, calls };
}

describe('createRefreshRunner', () => {
	it('coalesce duas chamadas globais simultâneas', async () => {
		const { runner, refresh, updateFeedCache, gate } = setup();

		const first = runner.run();
		const second = runner.run();
		await sleep();

		expect(refresh).toHaveBeenCalledTimes(1);
		expect(updateFeedCache).toHaveBeenCalledTimes(1);

		gate.resolve();
		const [a, b] = await Promise.all([first, second]);

		expect(a).toBe(b);
		expect(a.cache.updatedAt).toBe('global');
	});

	it('permite novo refresh depois que o anterior termina', async () => {
		const { runner, refresh, gate } = setup();

		const first = runner.run();
		gate.resolve();
		await first;

		const second = runner.run();
		gate.resolve();
		await second;

		expect(refresh).toHaveBeenCalledTimes(2);
	});

	it('não mistura refresh global com refresh de uma fonte', async () => {
		const { runner, refresh, gate, calls } = setup();

		const globalRun = runner.run();
		const sourceRun = runner.run({ sourceId: 'fonte-a' });
		await sleep();

		expect(refresh).toHaveBeenCalledTimes(2);
		expect(calls.sort()).toEqual(['fonte-a', 'global']);

		gate.resolve();
		const [globalOutcome, sourceOutcome] = await Promise.all([globalRun, sourceRun]);
		expect(globalOutcome.cache.updatedAt).toBe('global');
		expect(sourceOutcome.cache.updatedAt).toBe('fonte-a');
	});

	it('libera a fila quando o refresh falha', async () => {
		const { runner, refresh, gate } = setup();
		refresh.mockRejectedValueOnce(new Error('rede caiu'));

		await expect(runner.run()).rejects.toThrow('rede caiu');

		const retry = runner.run();
		gate.resolve();
		await expect(retry).resolves.toMatchObject({ results: [] });
		expect(refresh).toHaveBeenCalledTimes(2);
	});

	it('duas chamadas simultâneas compartilham a mesma falha', async () => {
		const { runner, refresh } = setup();
		refresh.mockRejectedValueOnce(new Error('rede caiu'));

		const first = runner.run();
		const second = runner.run();

		await expect(first).rejects.toThrow('rede caiu');
		await expect(second).rejects.toThrow('rede caiu');
		expect(refresh).toHaveBeenCalledTimes(1);
	});
});
