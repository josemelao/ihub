import { describe, expect, it } from 'vitest';
import { buildImportPreview } from './import-preview';
import type { HubData } from './types';

function hub(overrides: Partial<HubData> = {}): HubData {
	return {
		version: 1,
		settings: { accent: '#8AA4FF' },
		categories: [{ id: 'jogos', name: 'Jogos', color: '#8AA4FF', order: 1 }],
		groups: [],
		items: [],
		feedSources: [],
		savedFilters: [],
		...overrides
	};
}

describe('buildImportPreview', () => {
	it('mostra adicionados e atualizados no modo mesclar', () => {
		const current = hub({
			items: [
				{
					id: 'a',
					type: 'link',
					name: 'A',
					url: 'https://example.com/a',
					categoryId: 'jogos',
					tags: [],
					pinned: false,
					order: 1
				}
			]
		});
		const incoming = hub({
			categories: [{ id: 'jogos', name: 'Jogos Renomeados', color: '#8AA4FF', order: 1 }],
			items: [
				{
					id: 'a',
					type: 'link',
					name: 'A atualizado',
					url: 'https://example.com/a',
					categoryId: 'jogos',
					tags: [],
					pinned: false,
					order: 1
				},
				{
					id: 'b',
					type: 'link',
					name: 'B',
					url: 'https://example.com/b',
					categoryId: 'jogos',
					tags: [],
					pinned: false,
					order: 2
				}
			]
		});

		const preview = buildImportPreview(current, incoming, 'merge');

		expect(preview.changes.items.added).toEqual(['b']);
		expect(preview.changes.items.updated).toEqual(['a']);
		expect(preview.changes.items.removed).toEqual([]);
		expect(preview.changes.categories.updated).toEqual(['jogos']);
	});

	it('mostra removidos no modo substituir', () => {
		const current = hub({
			categories: [
				{ id: 'jogos', name: 'Jogos', color: '#8AA4FF', order: 1 },
				{ id: 'antiga', name: 'Antiga', color: '#8AA4FF', order: 2 }
			]
		});
		const incoming = hub({
			categories: [{ id: 'nova', name: 'Nova', color: '#8AA4FF', order: 1 }]
		});

		const preview = buildImportPreview(current, incoming, 'replace');

		expect(preview.changes.categories.added).toEqual(['nova']);
		expect(preview.changes.categories.removed).toEqual(['jogos', 'antiga']);
	});

	it('sinaliza conflito de settings', () => {
		const current = hub({ settings: { accent: '#111111' } });
		const incoming = hub({ settings: { accent: '#222222' } });

		const preview = buildImportPreview(current, incoming, 'merge');

		expect(preview.settingsConflict).toBe(true);
		expect(preview.currentSettings).toEqual({ accent: '#111111' });
		expect(preview.incomingSettings).toEqual({ accent: '#222222' });
	});

	it('não sinaliza conflito quando settings são iguais', () => {
		const preview = buildImportPreview(hub(), hub(), 'merge');
		expect(preview.settingsConflict).toBe(false);
	});

	it('resume o estado recebido', () => {
		const incoming = hub();
		const preview = buildImportPreview(hub(), incoming, 'merge', {
			version: 1,
			read: { a: 't', b: 't' },
			saved: ['a'],
			savedItems: {
				a: {
					item: {
						id: 'a',
						sourceId: 's',
						title: 'A',
						summary: '',
						url: 'https://example.com/a',
						publishedAt: '',
						thumbnail: null
					},
					sourceId: 's',
					sourceName: 'S',
					savedAt: ''
				}
			}
		});

		expect(preview.state).toEqual({ read: 2, saved: 1, snapshots: 1 });
	});
});
