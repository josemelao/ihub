import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const gitignore = readFileSync(join(process.cwd(), '.gitignore'), 'utf8');

describe('.gitignore de dados pessoais', () => {
	it('ignora todos os arquivos de dados do app', () => {
		for (const file of [
			'data/hub.json',
			'data/estado.json',
			'data/feed-cache.json',
			'data/notes.json',
			'data/highlights.json',
			'data/reading/',
			'data/archive.json',
			'data/archive/'
		]) {
			expect(gitignore).toContain(file);
		}
	});
});
