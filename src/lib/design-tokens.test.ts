import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const css = readFileSync(join(root, 'src', 'app.css'), 'utf8');

function svelteFiles(dir: string): string[] {
	const entries = readdirSync(dir);
	const files: string[] = [];
	for (const entry of entries) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) files.push(...svelteFiles(full));
		else if (entry.endsWith('.svelte')) files.push(full);
	}
	return files;
}

describe('tokens de design', () => {
	it('define tokens para os estados usados na UI', () => {
		for (const token of [
			'--panel-hover',
			'--line-soft',
			'--line-strong',
			'--ok',
			'--danger',
			'--danger-bg',
			'--danger-text'
		]) {
			expect(css).toContain(token);
		}
	});

	it('não mantém as cores de marca fixas fora dos tokens', () => {
		const usages = css
			.split('\n')
			.filter((line) => !/^\s*--[a-z-]+:/.test(line))
			.join('\n')
			.toLowerCase();

		for (const color of [
			'#202632',
			'#323946',
			'#3f6b55',
			'#f28b82',
			'#6b3f3f',
			'#2a1d20',
			'#f2c7c7'
		]) {
			expect(usages).not.toContain(color);
		}
	});

	it('não usa font-size inline (exceto o ícone dimensionado por prop)', () => {
		const offenders = svelteFiles(join(root, 'src'))
			.filter((file) => !file.endsWith('ItemIcon.svelte'))
			.filter((file) => /style="[^"]*font-size/.test(readFileSync(file, 'utf8')));

		expect(offenders).toEqual([]);
	});
});
