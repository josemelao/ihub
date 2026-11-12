import { mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { HubValidationError } from '../schema';
import { writeBytesAtomically, writeFileAtomically } from '../storage/atomic';
import { nodeFileDeps } from '../storage/node-deps';

const ARCHIVE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const ASSET_NAME = /^[a-f0-9]{16}\.(png|jpg|jpeg|gif|webp|avif)$/;
const ASSETS_INDEX = 'assets.json';

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	webp: 'image/webp',
	avif: 'image/avif'
};

function invalid(message: string): HubValidationError {
	return new HubValidationError([{ path: [], message }], 'archive');
}

export function assertArchiveId(id: string): void {
	if (!ARCHIVE_ID.test(id)) throw invalid(`Id de arquivo inválido: ${id}`);
}

function assertAssetName(name: string): void {
	if (!ASSET_NAME.test(name)) throw invalid(`Nome de asset inválido: ${name}`);
}

export async function writeArchiveDocument(dir: string, html: string): Promise<void> {
	await mkdir(dir, { recursive: true });
	await writeFileAtomically(join(dir, 'index.html'), html, nodeFileDeps);
}

export async function readArchiveDocument(dir: string): Promise<string | null> {
	try {
		return await readFile(join(dir, 'index.html'), 'utf-8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw error;
	}
}

export async function writeArchiveAssets(
	dir: string,
	assets: { name: string; bytes: Uint8Array; contentType: string }[]
): Promise<void> {
	for (const asset of assets) assertAssetName(asset.name);

	await mkdir(join(dir, 'assets'), { recursive: true });
	const index: Record<string, string> = {};

	for (const asset of assets) {
		await writeBytesAtomically(join(dir, 'assets', asset.name), asset.bytes, nodeFileDeps);
		index[asset.name] = asset.contentType;
	}

	await writeFileAtomically(
		join(dir, ASSETS_INDEX),
		`${JSON.stringify({ version: 1, assets: index }, null, 2)}\n`,
		nodeFileDeps
	);
}

export async function readArchiveAsset(
	dir: string,
	name: string
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
	assertAssetName(name);

	let index: Record<string, string> = {};
	try {
		const parsed = JSON.parse(await readFile(join(dir, ASSETS_INDEX), 'utf-8')) as {
			assets?: Record<string, string>;
		};
		index = parsed.assets ?? {};
	} catch {
		// Sem índice, infere pelo nome.
	}

	let bytes: Buffer;
	try {
		bytes = await readFile(join(dir, 'assets', name));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw error;
	}

	const ext = name.split('.').pop() ?? '';
	return {
		bytes,
		contentType: index[name] ?? CONTENT_TYPE_BY_EXT[ext] ?? 'application/octet-stream'
	};
}

export async function deleteArchiveDir(dir: string): Promise<void> {
	await rm(dir, { recursive: true, force: true });
}

export async function archiveDirSize(dir: string): Promise<{ bytes: number; assets: number }> {
	let bytes = 0;
	let assets = 0;

	try {
		const document = await stat(join(dir, 'index.html'));
		bytes += document.size;
	} catch {
		// sem documento
	}

	try {
		for (const name of await readdir(join(dir, 'assets'))) {
			try {
				const asset = await stat(join(dir, 'assets', name));
				bytes += asset.size;
				assets += 1;
			} catch {
				// asset removido no meio do caminho
			}
		}
	} catch {
		// sem assets
	}

	return { bytes, assets };
}
