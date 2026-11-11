import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from './concurrency';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('mapWithConcurrency', () => {
	it('preserva a ordem dos resultados', async () => {
		const result = await mapWithConcurrency([3, 1, 2], 2, async (value) => {
			await sleep(value * 5);
			return value * 10;
		});

		expect(result).toEqual([30, 10, 20]);
	});

	it('respeita o limite de execuções simultâneas', async () => {
		let running = 0;
		let peak = 0;

		await mapWithConcurrency(
			Array.from({ length: 10 }, (_, index) => index),
			3,
			async () => {
				running += 1;
				peak = Math.max(peak, running);
				await sleep(10);
				running -= 1;
			}
		);

		expect(peak).toBeLessThanOrEqual(3);
	});

	it('roda em paralelo até o limite', async () => {
		let running = 0;
		let peak = 0;

		await mapWithConcurrency([1, 2, 3, 4], 4, async () => {
			running += 1;
			peak = Math.max(peak, running);
			await sleep(20);
			running -= 1;
		});

		expect(peak).toBe(4);
	});

	it('propaga o erro da tarefa', async () => {
		await expect(
			mapWithConcurrency([1, 2], 2, async (value) => {
				if (value === 2) throw new Error('falhou');
				return value;
			})
		).rejects.toThrow('falhou');
	});

	it('aceita lista vazia', async () => {
		await expect(mapWithConcurrency([], 4, async () => 1)).resolves.toEqual([]);
	});
});
