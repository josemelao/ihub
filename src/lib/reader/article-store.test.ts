import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertArticleId, pruneArticleFiles, readArticleFile, writeArticleFile } from './article-store';
import type { ReadingArticle } from '../types';

const article = (id: string, fetchedAt: string): ReadingArticle => ({
	id,
	url: 'https://exemplo.com/a',
	finalUrl: 'https://exemplo.com/a',
	title: 'T',
	byline: '',
	siteName: 'E',
	excerpt: '',
	publishedAt: '',
	fetchedAt,
	length: 1,
	html: '<p>x</p>',
	text: 'x'
});

let dir: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), 'ihub-articles-'));
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe('article-store', () => {
	it('grava e lê de volta', async () => {
		await writeArticleFile(dir, article('abc', '2026-01-01T00:00:00.000Z'));

		expect((await readArticleFile(dir, 'abc'))?.title).toBe('T');
	});

	it('devolve null quando não existe', async () => {
		expect(await readArticleFile(dir, 'nao-existe')).toBeNull();
	});

	it('rejeita id com path traversal', () => {
		expect(() => assertArticleId('../x')).toThrow();
	});

	it('poda os mais antigos por fetchedAt', async () => {
		await writeArticleFile(dir, article('a', '2026-01-01T00:00:00.000Z'));
		await writeArticleFile(dir, article('b', '2026-01-02T00:00:00.000Z'));
		await writeArticleFile(dir, article('c', '2026-01-03T00:00:00.000Z'));

		expect(await pruneArticleFiles(dir, 2)).toBe(1);
		expect(await readArticleFile(dir, 'a')).toBeNull();
		expect((await readArticleFile(dir, 'c'))?.id).toBe('c');
	});
});
