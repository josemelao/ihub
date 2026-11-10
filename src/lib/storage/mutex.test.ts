import { describe, expect, it } from 'vitest';
import { Mutex, createLockRegistry } from './mutex';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Mutex', () => {
	it('serializa tarefas na ordem de chegada', async () => {
		const mutex = new Mutex();
		const events: string[] = [];
		let active = 0;
		let maxActive = 0;

		const task = (name: string, delay: number) =>
			mutex.run(async () => {
				active += 1;
				maxActive = Math.max(maxActive, active);
				events.push(`start:${name}`);
				await sleep(delay);
				events.push(`end:${name}`);
				active -= 1;
				return name;
			});

		const results = await Promise.all([task('a', 20), task('b', 1), task('c', 5)]);

		expect(results).toEqual(['a', 'b', 'c']);
		expect(maxActive).toBe(1);
		expect(events).toEqual(['start:a', 'end:a', 'start:b', 'end:b', 'start:c', 'end:c']);
	});

	it('não trava a fila quando uma tarefa falha', async () => {
		const mutex = new Mutex();
		const failing = mutex.run(async () => {
			throw new Error('falhou');
		});

		await expect(failing).rejects.toThrow('falhou');
		await expect(mutex.run(async () => 'ok')).resolves.toBe('ok');
	});
});

describe('createLockRegistry', () => {
	it('executa chaves diferentes em paralelo', async () => {
		const registry = createLockRegistry();
		const events: string[] = [];
		let release!: () => void;
		const gate = new Promise<void>((resolve) => (release = resolve));

		const first = registry.withLock('a', async () => {
			events.push('a:start');
			await gate;
			events.push('a:end');
		});

		await sleep(5);

		const second = registry.withLock('b', async () => {
			events.push('b:start');
			events.push('b:end');
		});

		await second;
		expect(events).toEqual(['a:start', 'b:start', 'b:end']);
		release();
		await first;
	});

	it('adquire múltiplas chaves em ordem estável sem deadlock', async () => {
		const registry = createLockRegistry();
		const order: string[] = [];

		const first = registry.withLocks(['b', 'a'], async () => {
			order.push('first');
			await sleep(5);
		});
		const second = registry.withLocks(['a', 'b'], async () => {
			order.push('second');
		});

		await expect(Promise.all([first, second])).resolves.toBeDefined();
		expect(order).toEqual(['first', 'second']);
	});

	it('serializa updates concorrentes na mesma chave', async () => {
		const registry = createLockRegistry();
		let counter = 0;

		await Promise.all(
			Array.from({ length: 10 }, () =>
				registry.withLock('contador', async () => {
					const current = counter;
					await sleep(1);
					counter = current + 1;
				})
			)
		);

		expect(counter).toBe(10);
	});
});
