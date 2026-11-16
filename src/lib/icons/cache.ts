import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchPublicBytes } from '../net/safe-fetch';

const MAX_ICON_BYTES = 512_000;
const MISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const EXT_BY_TYPE: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/gif': 'gif',
	'image/webp': 'webp',
	'image/avif': 'avif',
	'image/x-icon': 'ico',
	'image/vnd.microsoft.icon': 'ico'
};

const TYPE_BY_EXT: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	gif: 'image/gif',
	webp: 'image/webp',
	avif: 'image/avif',
	ico: 'image/x-icon'
};

export interface CachedIcon {
	bytes: Uint8Array;
	contentType: string;
}

export interface FetchedIconBytes {
	bytes: Uint8Array;
	contentType: string | null;
}

export type IconFetcher = (
	url: string,
	options: { maxBytes: number; timeoutMs: number }
) => Promise<FetchedIconBytes>;

export interface IconOptions {
	fetchBytes?: IconFetcher;
	now?: () => Date;
}

function parseSource(source: string): URL | null {
	let url: URL;
	try {
		url = new URL(source.trim());
	} catch {
		return null;
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
	if (url.username || url.password) return null;
	return url;
}

function isSite(url: URL): boolean {
	return url.pathname === '/' && !url.search && !url.hash;
}

/** URL canônica usada como chave do cache. */
export function iconCacheKey(source: string): string | null {
	const url = parseSource(source);
	if (!url) return null;
	const keySource = isSite(url) ? url.origin : url.toString();
	return createHash('sha256').update(keySource).digest('hex').slice(0, 32);
}

/** Candidatos de favicon: site → três caminhos comuns; arquivo → a própria URL. */
export function iconCandidates(source: string): string[] {
	const url = parseSource(source);
	if (!url) return [];
	if (!isSite(url)) return [url.toString()];
	return [
		`${url.origin}/favicon.ico`,
		`${url.origin}/favicon.png`,
		`${url.origin}/apple-touch-icon.png`
	];
}

async function readCached(directory: string, key: string): Promise<CachedIcon | null> {
	for (const [ext, contentType] of Object.entries(TYPE_BY_EXT)) {
		try {
			const bytes = await readFile(join(directory, `${key}.${ext}`));
			return { bytes: new Uint8Array(bytes), contentType };
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		}
	}
	return null;
}

async function missIsFresh(path: string, now: Date): Promise<boolean> {
	try {
		const raw = await readFile(path, 'utf-8');
		const checkedAt = Date.parse((JSON.parse(raw) as { checkedAt?: string }).checkedAt ?? '');
		if (Number.isNaN(checkedAt)) return false;
		return now.getTime() - checkedAt < MISS_TTL_MS;
	} catch {
		return false;
	}
}

/** Lê do cache local; se faltar, baixa uma vez e grava em `data/icons`. */
export async function getOrFetchIcon(
	dataDir: string,
	source: string,
	options: IconOptions = {}
): Promise<CachedIcon | null> {
	const key = iconCacheKey(source);
	if (!key) return null;

	const directory = join(dataDir, 'icons');
	const cached = await readCached(directory, key);
	if (cached) return cached;

	const missPath = join(directory, `${key}.miss`);
	const now = options.now ?? (() => new Date());
	if (await missIsFresh(missPath, now())) return null;

	const fetcher: IconFetcher =
		options.fetchBytes ??
		((url, limits) =>
			fetchPublicBytes(url, { maxBytes: limits.maxBytes, timeoutMs: limits.timeoutMs }));

	for (const candidate of iconCandidates(source)) {
		try {
			const fetched = await fetcher(candidate, {
				maxBytes: MAX_ICON_BYTES,
				timeoutMs: 8_000
			});
			const contentType = fetched.contentType?.split(';')[0].trim().toLowerCase() ?? '';
			const ext = EXT_BY_TYPE[contentType];
			if (!ext) continue;

			await mkdir(directory, { recursive: true });
			await writeFile(join(directory, `${key}.${ext}`), fetched.bytes);
			await rm(missPath, { force: true });
			return { bytes: fetched.bytes, contentType };
		} catch {
			// tenta o próximo candidato
		}
	}

	await mkdir(directory, { recursive: true });
	await writeFile(
		missPath,
		`${JSON.stringify({ source, checkedAt: now().toISOString() }, null, 2)}\n`,
		'utf-8'
	);
	return null;
}
