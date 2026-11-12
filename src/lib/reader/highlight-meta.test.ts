import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HIGHLIGHT_COLORS, HIGHLIGHT_COLOR_LABELS } from './highlight-meta';

const root = process.cwd();
const read = (path: string): string => readFileSync(join(root, path), 'utf8');

describe('constantes de destaque seguras para o cliente', () => {
	it('não importa APIs de Node no módulo carregado pelo navegador', () => {
		expect(read('src/lib/reader/highlight-meta.ts')).not.toMatch(/from 'node:/);
	});

	it('cobre todas as cores com rótulo textual', () => {
		expect(HIGHLIGHT_COLORS).toEqual(['yellow', 'green', 'blue', 'pink']);
		for (const color of HIGHLIGHT_COLORS) {
			expect(HIGHLIGHT_COLOR_LABELS[color]).toBeTruthy();
		}
	});

	it('componentes de cliente importam as constantes do módulo seguro', () => {
		const clientFiles = [
			'src/routes/highlights/+page.svelte',
			'src/routes/ler/[id]/+page.svelte',
			'src/lib/components/HighlightDialog.svelte',
			'src/lib/components/HighlightToolbar.svelte'
		];

		for (const file of clientFiles) {
			expect(read(file), file).toContain("from '#lib/reader/highlight-meta'");
		}
	});
});
