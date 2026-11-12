import { describe, expect, it } from 'vitest';
import { updateSettings } from './hub-edit';
import { parseHub } from './schema';
import type { HubData } from './types';

const base = (): HubData => ({
	version: 2,
	settings: { accent: '#8AA4FF' },
	categories: [],
	groups: [],
	items: [],
	feedSources: [],
	savedFilters: []
});

describe('preferências de leitura', () => {
	it('grava densidade, fonte e contraste', () => {
		const updated = updateSettings(base(), {
			density: 'compact',
			fontSize: 15,
			highContrast: true
		});

		expect(updated.settings).toMatchObject({
			accent: '#8AA4FF',
			density: 'compact',
			fontSize: 15,
			highContrast: true
		});
		expect(() => parseHub(updated)).not.toThrow();
	});

	it('desliga o contraste sem perder o accent', () => {
		const on = updateSettings(base(), { highContrast: true });

		expect(updateSettings(on, { highContrast: false }).settings).toMatchObject({
			accent: '#8AA4FF',
			highContrast: false
		});
	});
});
