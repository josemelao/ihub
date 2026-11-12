import { mkdir, readFile, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { HubValidationError, parseReadingArticle } from '../schema';
import type { ReadingArticle } from '../types';
import { writeFileAtomically } from '../storage/atomic';
import { nodeFileDeps } from '../storage/node-deps';
import { sanitizeArticleHtml } from './extract';

export const MAX_ARTICLES = 300;

const ARTICLE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function assertArticleId(id: string): void {
	if (!ARTICLE_ID.test(id)) {
		throw new HubValidationError(
			[{ path: ['id'], message: `Id de artigo inválido: ${id}` }],
			'reading'
		);
	}
}

export async function readArticleFile(dir: string, id: string): Promise<ReadingArticle | null> {
	assertArticleId(id);

	let raw: string;
	try {
		raw = await readFile(join(dir, `${id}.json`), 'utf-8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw error;
	}

	try {
		const article = parseReadingArticle(JSON.parse(raw));
		// Defesa em profundidade: o arquivo é local e editável; o `{@html}` só
		// deve receber HTML que passou pelo sanitizador nesta leitura.
		return { ...article, html: sanitizeArticleHtml(article.html, article.finalUrl) };
	} catch (error) {
		if (error instanceof HubValidationError) throw error;
		throw new HubValidationError([{ path: [], message: 'reading: JSON inválido.' }], 'reading');
	}
}

export async function writeArticleFile(dir: string, article: ReadingArticle): Promise<void> {
	const data = parseReadingArticle(article);
	await mkdir(dir, { recursive: true });
	await writeFileAtomically(
		join(dir, `${data.id}.json`),
		`${JSON.stringify(data, null, 2)}\n`,
		nodeFileDeps
	);
}

/** Remove os artigos mais antigos (por `fetchedAt`) acima de `max`. */
export async function pruneArticleFiles(dir: string, max = MAX_ARTICLES): Promise<number> {
	let names: string[];
	try {
		names = (await readdir(dir)).filter((name) => name.endsWith('.json'));
	} catch {
		return 0;
	}

	const entries: { name: string; fetchedAt: string }[] = [];
	for (const name of names) {
		try {
			const parsed = parseReadingArticle(JSON.parse(await readFile(join(dir, name), 'utf-8')));
			entries.push({ name, fetchedAt: parsed.fetchedAt });
		} catch {
			// Arquivo inválido não deve impedir a poda dos demais.
		}
	}

	if (entries.length <= max) return 0;

	entries.sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt));
	const remove = entries.slice(max);
	await Promise.all(remove.map((entry) => unlink(join(dir, entry.name)).catch(() => undefined)));
	return remove.length;
}
