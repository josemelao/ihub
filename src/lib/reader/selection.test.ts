import { describe, expect, it } from 'vitest';
import { buildSelectionInfo } from './selection';

describe('buildSelectionInfo', () => {
	const text = 'trecho e trecho e trecho';

	it('normaliza o trecho e calcula a ocorrência pela posição', () => {
		expect(buildSelectionInfo('  trecho  ', text, 0)).toEqual({ quote: 'trecho', occurrence: 0 });
		expect(buildSelectionInfo('trecho', text, 9)).toEqual({ quote: 'trecho', occurrence: 1 });
	});

	it('ignora seleção vazia ou longa', () => {
		expect(buildSelectionInfo('   ', text, 0)).toBeNull();
		expect(buildSelectionInfo('x'.repeat(2001), text, 0)).toBeNull();
	});
});
