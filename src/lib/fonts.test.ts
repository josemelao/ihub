import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('fontes locais', () => {
	it('não carrega fontes do Google', () => {
		const html = read('src/app.html');
		const css = read('src/app.css');

		expect(html).not.toContain('fonts.googleapis.com');
		expect(html).not.toContain('fonts.gstatic.com');
		expect(css).not.toContain('fonts.googleapis.com');
	});

	it('declara @font-face apontando para os arquivos locais', () => {
		const css = read('src/app.css');

		expect(css).toContain("url('/fonts/inter.woff2')");
		expect(css).toContain("url('/fonts/space-grotesk.woff2')");
	});

	it('entrega os arquivos woff2 no static', () => {
		for (const file of ['inter.woff2', 'space-grotesk.woff2']) {
			const path = join(root, 'static', 'fonts', file);
			expect(existsSync(path)).toBe(true);
			expect(readFileSync(path).subarray(0, 4).toString('ascii')).toBe('wOF2');
		}
	});

	it('inclui a licença OFL das duas famílias', () => {
		expect(existsSync(join(root, 'static', 'fonts', 'OFL-Inter.txt'))).toBe(true);
		expect(existsSync(join(root, 'static', 'fonts', 'OFL-SpaceGrotesk.txt'))).toBe(true);
	});
});

describe('imagens externas sem referrer', () => {
	it('aplica referrerpolicy no card, no lightbox e nos ícones', () => {
		expect(read('src/lib/components/FeedCard.svelte')).toContain('referrerpolicy="no-referrer"');
		expect(read('src/lib/components/ImageLightbox.svelte')).toContain(
			'referrerpolicy="no-referrer"'
		);
		expect(read('src/lib/components/ItemIcon.svelte')).toContain('referrerpolicy="no-referrer"');
	});
});
