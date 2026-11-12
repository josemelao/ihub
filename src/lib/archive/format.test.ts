import { describe, expect, it } from 'vitest';
import { formatBytes } from './format';

describe('formatBytes', () => {
	it('formata bytes em pt-BR', () => {
		expect(formatBytes(0)).toBe('0 B');
		expect(formatBytes(1024)).toBe('1,0 KB');
		expect(formatBytes(12_300_000)).toBe('11,7 MB');
	});
});
