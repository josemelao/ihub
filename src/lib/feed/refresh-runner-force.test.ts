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

function setup() {
	let open!: () => void;
	const gate = new Promise<void>((resolve) => {
		open = resolve;
	});
	const flags: boolean[] = [];

	const refresh = vi.fn(
		async (_hub: HubData, _cache: FeedCache, options: { force: boolean; sourceId?: string }) => {
			flags.push(options.force);
			await gate;
			const outcome: RefreshOutcome = { cache: cache(), results: [] };
			return outcome;
		}
	);
	const runner = createRefreshRunner({
		loadHub: async () => hub,
		refresh,
		updateFeedCache: async (fn) => fn(cache())
	});

	return { runner, refresh, open, flags };
}

describe('createRefreshRunner com force', () => {
	it('enfileira um refresh forçado depois do não-forçado em andamento', async () => {
		const { runner, refresh, open, flags } = setup();

		const normal = runner.run();
		const forced = runner.run({ force: true });
		await sleep();

		expect(refresh).toHaveBeenCalledTimes(1);

		open();
		await Promise.all([normal, forced]);

		expect(refresh).toHaveBeenCalledTimes(2);
		expect(flags).toEqual([false, true]);
	});

	it('coalesce dois pedidos forçados simultâneos', async () => {
		const { runner, refresh, open } = setup();

		const first = runner.run({ force: true });
		const second = runner.run({ force: true });
		await sleep();

		expect(refresh).toHaveBeenCalledTimes(1);

		open();
		const [a, b] = await Promise.all([first, second]);
		expect(a).toBe(b);
	});

	it('não enfileira outro forçado quando o atual já é forçado', async () => {
		const { runner, refresh, open } = setup();

		const forced = runner.run({ force: true });
		const normal = runner.run();
		await sleep();

		expect(refresh).toHaveBeenCalledTimes(1);

		open();
		await Promise.all([forced, normal]);
		expect(refresh).toHaveBeenCalledTimes(1);
	});

	it('não bloqueia o refresh global quando a fonte específica está rodando', async () => {
		const { runner, open } = setup();

		const sourceRun = runner.run({ sourceId: 'fonte-a' });
		const globalRun = runner.run({ force: true });
		await sleep();

		open();
		await Promise.all([sourceRun, globalRun]);
		expect(globalRun).resolves.toMatchObject({ results: [] });
	});

	it('mantém a fila livre quando a execução anterior falha', async () => {
		const { runner, refresh, open } = setup();
		refresh.mockRejectedValueOnce(new Error('rede caiu'));

		const normal = runner.run();
		const forced = runner.run({ force: true });

		await expect(normal).rejects.toThrow('rede caiu');
		open();
		await expect(forced).resolves.toMatchObject({ results: [] });
		expect(refresh).toHaveBeenCalledTimes(2);
	});
});
