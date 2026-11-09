import { describe, it, expect } from 'vitest';
import { spanForHeight } from './masonry';

describe('spanForHeight', () => {
	it('calcula o número de linhas para cobrir a altura', () => {
		expect(spanForHeight(100, 8, 12)).toBe(6);
		expect(spanForHeight(8, 8, 12)).toBe(1);
		expect(spanForHeight(20, 8, 12)).toBe(2);
	});

	it('nunca retorna menos de uma linha', () => {
		expect(spanForHeight(0, 8, 12)).toBe(1);
		expect(spanForHeight(Number.NaN, 8, 12)).toBe(1);
	});
});
