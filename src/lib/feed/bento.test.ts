import { describe, it, expect } from 'vitest';
import { assignBentoSpans } from './bento';

describe('assignBentoSpans', () => {
	it('varia a largura de imagens e textos sem sair de 2, 3 ou 4', () => {
		const entries = [
			{ hasImage: true },
			{ hasImage: true },
			{ hasImage: true },
			{ hasImage: true },
			{ hasImage: true },
			{ hasImage: false },
			{ hasImage: false },
			{ hasImage: false }
		];

		const spans = assignBentoSpans(entries);
		expect(spans.slice(0, 5)).toEqual([4, 3, 2, 3, 4]);
		expect(spans.slice(5)).toEqual([2, 3, 2]);
		expect(spans.every((span) => [2, 3, 4].includes(span))).toBe(true);
	});

	it('só usa 1/3 e 1/2 quando não há imagens', () => {
		expect(assignBentoSpans([{ hasImage: false }, { hasImage: false }])).toEqual([2, 3]);
	});
});
