import { describe, it, expect } from 'vitest';
import { columnsForWidth, computeMasonryLayout } from './masonry';

describe('columnsForWidth', () => {
	it('usa 3 colunas em telas largas, 2 no meio e 1 no estreito', () => {
		expect(columnsForWidth(1200)).toBe(3);
		expect(columnsForWidth(760)).toBe(2);
		expect(columnsForWidth(400)).toBe(1);
	});
});

describe('computeMasonryLayout', () => {
	it('posiciona cada card na coluna mais baixa', () => {
		const layout = computeMasonryLayout([100, 50, 80], 2, 100, 10);

		expect(layout.positions[0]).toEqual({ left: 0, top: 0, width: 100, height: 100 });
		expect(layout.positions[1]).toEqual({ left: 110, top: 0, width: 100, height: 50 });
		expect(layout.positions[2]).toEqual({ left: 110, top: 60, width: 100, height: 80 });
		expect(layout.height).toBe(140);
	});

	it('funciona com uma coluna', () => {
		const layout = computeMasonryLayout([100, 50], 1, 300, 10);
		expect(layout.positions[1].top).toBe(110);
		expect(layout.height).toBe(160);
	});
});
