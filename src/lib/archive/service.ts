import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { mapWithConcurrency } from '../feed/concurrency';
import { fetchPublicBytes, fetchPublicText } from '../net/safe-fetch';
import type { ArchiveEntry, ArchiveIndex, FeedItem, FeedSourceType, HubStorage } from '../types';
import { buildArchiveDocument, MAX_ARCHIVE_HTML_BYTES, sanitizeArchiveBody } from './sanitize';
import {
	archiveDirSize,
	deleteArchiveDir,
	readArchiveDocument,
	writeArchiveAssets,
	writeArchiveDocument
} from './store';

export const MAX_ARCHIVES = 200;
export const MAX_TOTAL_BYTES = 500 * 1024 * 1024;
export const MAX_IMAGES = 20;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGES_BYTES = 20 * 1024 * 1024;
export const MIN_TEXT_CHARS = 100;

const MAX_JOBS = 2;

const EXT_BY_TYPE: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/gif': 'gif',
	'image/webp': 'webp',
	'image/avif': 'avif'
};

export function assetName(url: string, contentType: string): string {
	const type = contentType.split(';')[0].trim().toLowerCase();
	const ext = EXT_BY_TYPE[type] ?? 'png';
	return `${createHash('sha1').update(url).digest('hex').slice(0, 16)}.${ext}`;
}

export interface ArchiveInput {
	item: FeedItem;
	title: string;
	sourceType: FeedSourceType;
}

export interface ArchiveDeps {
	text?: (url: string) => Promise<{ text: string; finalUrl: string }>;
	bytes?: (url: string) => Promise<{ bytes: Uint8Array; contentType: string }>;
	now?: () => Date;
	archiveRoot?: string;
}

interface JobToken {
	cancelled: boolean;
}

type ArchiveStorage = Pick<
	HubStorage,
	'loadArchiveIndex' | 'updateArchiveIndex' | 'saveArchiveIndex'
>;

const jobs = new Map<string, { token: JobToken; promise: Promise<ArchiveEntry> }>();
const queue: (() => void)[] = [];
let active = 0;

function runWithSlot<T>(fn: () => Promise<T>): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const start = () => {
			active += 1;
			fn()
				.then(resolve, reject)
				.finally(() => {
					active -= 1;
					const next = queue.shift();
					if (next) next();
				});
		};

		if (active < MAX_JOBS) start();
		else queue.push(start);
	});
}

function nowIso(deps: ArchiveDeps): string {
	return (deps.now?.() ?? new Date()).toISOString();
}

function rootOf(deps: ArchiveDeps): string {
	return deps.archiveRoot ?? join(process.env.HUB_DATA_DIR ?? 'data', 'archive');
}

function baseEntry(input: ArchiveInput, status: ArchiveEntry['status'], at: string): ArchiveEntry {
	return {
		id: input.item.id,
		status,
		title: input.title || input.item.title,
		url: input.item.url,
		bytes: 0,
		assets: 0,
		createdAt: at,
		updatedAt: at
	};
}

function errorText(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	return message.slice(0, 300) || 'Falha ao arquivar.';
}

async function saveEntry(
	storage: ArchiveStorage,
	entry: ArchiveEntry,
	token?: JobToken
): Promise<ArchiveEntry> {
	await storage.updateArchiveIndex((data) => {
		const entries = { ...data.entries };
		if (token?.cancelled) delete entries[entry.id];
		else entries[entry.id] = entry;
		return { ...data, entries };
	});
	return entry;
}

function defaultText(url: string): Promise<{ text: string; finalUrl: string }> {
	return fetchPublicText(url, { maxBytes: 5_000_000, timeoutMs: 10_000 });
}

async function defaultBytes(url: string): Promise<{ bytes: Uint8Array; contentType: string }> {
	const result = await fetchPublicBytes(url, { maxBytes: MAX_IMAGE_BYTES, timeoutMs: 10_000 });
	return { bytes: result.bytes, contentType: result.contentType ?? 'application/octet-stream' };
}

/**
 * Reserva o slot `pending` e o teto dentro do lock do índice; só então dispara
 * o job (máx. 2 em voo, um por item). Devolve a entrada persistida na reserva.
 */
export async function enqueueArchive(
	storage: ArchiveStorage,
	input: ArchiveInput,
	deps: ArchiveDeps = {}
): Promise<ArchiveEntry> {
	const at = nowIso(deps);

	if (input.sourceType !== 'rss') {
		return {
			...baseEntry(input, 'failed', at),
			error: 'Arquivamento disponível para fontes RSS.'
		};
	}

	if (jobs.has(input.item.id)) return baseEntry(input, 'pending', at);

	let reserved: ArchiveEntry | null = null;
	let blocked: ArchiveEntry | null = null;

	await storage.updateArchiveIndex((data) => {
		const current = data.entries[input.item.id];
		if (current && (current.status === 'ready' || current.status === 'pending')) {
			reserved = current;
			return data;
		}

		const entries = Object.values(data.entries).filter((entry) => entry.id !== input.item.id);
		const activeEntries = entries.filter(
			(entry) => entry.status === 'ready' || entry.status === 'pending'
		);
		const totalBytes = entries.reduce((total, entry) => total + entry.bytes, 0);

		if (activeEntries.length >= MAX_ARCHIVES) {
			blocked = saveBlocked(
				input,
				at,
				'Limite de 200 arquivos atingido. Remova alguns em Gerenciar.'
			);
			return { ...data, entries: { ...data.entries, [input.item.id]: blocked } };
		}
		if (totalBytes >= MAX_TOTAL_BYTES) {
			blocked = saveBlocked(
				input,
				at,
				'Limite de 500 MB de arquivos atingido. Remova alguns em Gerenciar.'
			);
			return { ...data, entries: { ...data.entries, [input.item.id]: blocked } };
		}

		const pending: ArchiveEntry = {
			...baseEntry(input, 'pending', at),
			createdAt: current?.createdAt ?? at
		};
		reserved = pending;
		return { ...data, entries: { ...data.entries, [input.item.id]: pending } };
	});

	if (blocked) return blocked;
	if (!reserved) return baseEntry(input, 'failed', at);

	const pending = reserved as ArchiveEntry;
	if (pending.status !== 'pending') return pending;

	const token: JobToken = { cancelled: false };
	const promise = runWithSlot(() => archiveItem(storage, input, deps, token)).finally(() => {
		const job = jobs.get(input.item.id);
		if (job?.token === token) jobs.delete(input.item.id);
	});
	jobs.set(input.item.id, { token, promise });
	void promise.catch(() => undefined);

	return pending;
}

function saveBlocked(input: ArchiveInput, at: string, error: string): ArchiveEntry {
	return { ...baseEntry(input, 'failed', at), error };
}

export async function archiveItem(
	storage: ArchiveStorage,
	input: ArchiveInput,
	deps: ArchiveDeps = {},
	token: JobToken = { cancelled: false }
): Promise<ArchiveEntry> {
	const at = nowIso(deps);
	const id = input.item.id;
	const dir = join(rootOf(deps), id);

	if (input.sourceType !== 'rss') {
		return saveEntry(
			storage,
			{ ...baseEntry(input, 'failed', at), error: 'Arquivamento disponível para fontes RSS.' },
			token
		);
	}

	const current = (await storage.loadArchiveIndex().catch(() => null))?.entries[id] ?? null;
	if (current?.status === 'ready') return current;
	const createdAt = current?.createdAt ?? at;

	try {
		if (token.cancelled) throw new Error('Arquivamento cancelado.');

		const fetched = await (deps.text ?? defaultText)(input.item.url);
		if (token.cancelled) throw new Error('Arquivamento cancelado.');

		const { html, imageUrls, textLength } = sanitizeArchiveBody(fetched.text, fetched.finalUrl);
		if (textLength < MIN_TEXT_CHARS) {
			throw new Error('Conteúdo principal não encontrado.');
		}
		if (Buffer.byteLength(html, 'utf8') > MAX_ARCHIVE_HTML_BYTES) {
			throw new Error('Página grande demais para arquivar.');
		}

		let totalImageBytes = 0;
		const fetchedAssets = await mapWithConcurrency(imageUrls, 4, async (url) => {
			if (totalImageBytes >= MAX_IMAGES_BYTES) return null;
			try {
				const asset = await (deps.bytes ?? defaultBytes)(url);
				if (totalImageBytes + asset.bytes.byteLength > MAX_IMAGES_BYTES) return null;
				totalImageBytes += asset.bytes.byteLength;
				return {
					url,
					name: assetName(url, asset.contentType),
					bytes: asset.bytes,
					contentType: asset.contentType
				};
			} catch {
				return null;
			}
		});

		const assets = fetchedAssets.filter(
			(asset): asset is { url: string; name: string; bytes: Uint8Array; contentType: string } =>
				Boolean(asset)
		);
		const assetMap = new Map<string, string>();
		for (const asset of assets) assetMap.set(asset.url, asset.name);

		const document = buildArchiveDocument({
			title: input.title || input.item.title,
			url: input.item.url,
			itemId: id,
			body: html,
			assetMap,
			generatedAt: at
		});

		if (token.cancelled) throw new Error('Arquivamento cancelado.');

		await writeArchiveAssets(dir, assets);
		await writeArchiveDocument(dir, document);
		if (token.cancelled) throw new Error('Arquivamento cancelado.');

		const size = await archiveDirSize(dir);

		return saveEntry(
			storage,
			{
				...baseEntry(input, 'ready', nowIso(deps)),
				bytes: size.bytes,
				assets: size.assets,
				createdAt
			},
			token
		);
	} catch (error) {
		await deleteArchiveDir(dir).catch(() => undefined);
		if (token.cancelled) {
			return {
				...baseEntry(input, 'failed', nowIso(deps)),
				error: 'Arquivamento removido.'
			};
		}
		return saveEntry(
			storage,
			{
				...baseEntry(input, 'failed', nowIso(deps)),
				error: errorText(error),
				createdAt
			},
			token
		);
	}
}

export function cancelArchive(id: string): void {
	const job = jobs.get(id);
	if (job) job.token.cancelled = true;
}

export async function deleteArchive(
	storage: ArchiveStorage,
	id: string,
	deps: ArchiveDeps = {}
): Promise<boolean> {
	const job = jobs.get(id);
	cancelArchive(id);

	const existed = Boolean((await storage.loadArchiveIndex()).entries[id]);
	await deleteArchiveDir(join(rootOf(deps), id)).catch(() => undefined);

	if (existed) {
		await storage.updateArchiveIndex((data) => {
			const entries = { ...data.entries };
			delete entries[id];
			return { ...data, entries };
		});
	}

	if (job) {
		void job.promise.finally(() => deleteArchiveDir(join(rootOf(deps), id)).catch(() => undefined));
	}

	return existed;
}

export async function reconcileArchiveIndex(
	storage: ArchiveStorage,
	deps: ArchiveDeps = {}
): Promise<ArchiveIndex> {
	const index = await storage.loadArchiveIndex();
	const root = rootOf(deps);
	const missing: string[] = [];

	for (const entry of Object.values(index.entries)) {
		if (entry.status !== 'ready') continue;
		if ((await readArchiveDocument(join(root, entry.id))) === null) missing.push(entry.id);
	}

	if (missing.length === 0) return index;

	const at = nowIso(deps);
	return storage.updateArchiveIndex((data) => {
		const entries = { ...data.entries };
		for (const id of missing) {
			const entry = entries[id];
			if (!entry) continue;
			entries[id] = {
				...entry,
				status: 'failed',
				error: 'Arquivo não encontrado no disco.',
				updatedAt: at
			};
		}
		return { ...data, entries };
	});
}
