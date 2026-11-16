import { createWriteStream } from 'node:fs';
import { once } from 'node:events';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { strToU8, Zip, ZipPassThrough } from 'fflate';

export interface BackupFile {
	name: string;
	path: string;
}

export interface BackupManifest {
	app: 'meu-hub';
	version: string;
	createdAt: string;
	includesArchive: boolean;
	files: string[];
	counts: { reading: number; archive: number };
	totalBytes: number;
}

const BASE_FILES = ['hub.json', 'estado.json', 'feed-cache.json', 'notes.json', 'highlights.json'];

async function addFileIfPresent(
	files: BackupFile[],
	dataDir: string,
	name: string
): Promise<void> {
	const path = join(dataDir, name);
	try {
		const info = await stat(path);
		if (!info.isFile()) return;
	} catch {
		return;
	}
	files.push({ name, path });
}

async function walk(
	directory: string,
	prefix: string,
	files: BackupFile[]
): Promise<void> {
	let entries;
	try {
		entries = await readdir(directory, { withFileTypes: true });
	} catch {
		return;
	}

	entries.sort((a, b) => a.name.localeCompare(b.name));
	for (const entry of entries) {
		const full = join(directory, entry.name);
		const name = `${prefix}/${entry.name}`;
		if (entry.isDirectory()) await walk(full, name, files);
		else if (entry.isFile()) files.push({ name, path: full });
	}
}

async function listReading(dataDir: string, files: BackupFile[]): Promise<void> {
	let names: string[];
	try {
		names = (await readdir(join(dataDir, 'reading'))).filter((name) => name.endsWith('.json'));
	} catch {
		return;
	}

	names.sort();
	for (const name of names) {
		files.push({ name: `reading/${name}`, path: join(dataDir, 'reading', name) });
	}
}

async function listArchive(dataDir: string, files: BackupFile[]): Promise<void> {
	await addFileIfPresent(files, dataDir, 'archive.json');

	let entries;
	try {
		entries = await readdir(join(dataDir, 'archive'), { withFileTypes: true });
	} catch {
		return;
	}

	const archiveEntries = entries
		.filter((entry) => entry.isDirectory())
		.sort((a, b) => a.name.localeCompare(b.name));
	for (const entry of archiveEntries) {
		await walk(join(dataDir, 'archive', entry.name), `archive/${entry.name}`, files);
	}
}

/** Monta a lista de arquivos e o manifesto que vão para o ZIP de backup. */
export async function collectBackupFiles(
	dataDir: string,
	options: { includeArchive?: boolean } = {}
): Promise<{ files: BackupFile[]; manifest: BackupManifest }> {
	const includeArchive = options.includeArchive === true;
	const files: BackupFile[] = [];

	for (const name of BASE_FILES) await addFileIfPresent(files, dataDir, name);
	await listReading(dataDir, files);
	if (includeArchive) await listArchive(dataDir, files);

	let totalBytes = 0;
	for (const file of files) {
		try {
			totalBytes += (await stat(file.path)).size;
		} catch {
			// arquivo removido no meio da coleta
		}
	}

	const manifest: BackupManifest = {
		app: 'meu-hub',
		version: process.env.npm_package_version ?? '0.0.1',
		createdAt: new Date().toISOString(),
		includesArchive: includeArchive,
		files: files.map((file) => file.name),
		counts: {
			reading: files.filter((file) => file.name.startsWith('reading/')).length,
			archive: files.filter((file) => file.name.startsWith('archive/')).length
		},
		totalBytes
	};

	return { files, manifest };
}

/**
 * Grava o ZIP em streaming para não segurar todos os arquivos na memória.
 * O manifesto entra primeiro; o restante é copiado sem recompressão.
 */
export async function writeBackupZip(
	target: string,
	files: BackupFile[],
	manifest: BackupManifest
): Promise<void> {
	const out = createWriteStream(target);
	let writing: Promise<void> = Promise.resolve();
	let failure: Error | null = null;
	let finish: () => void = () => undefined;
	const zipDone = new Promise<void>((resolve) => {
		finish = resolve;
	});

	const zip = new Zip((error, chunk, final) => {
		if (error) {
			failure = error;
			finish();
			return;
		}
		writing = writing.then(async () => {
			if (!out.write(chunk)) await once(out, 'drain');
		});
		if (final) finish();
	});

	const add = async (name: string, data: Uint8Array): Promise<void> => {
		const entry = new ZipPassThrough(name);
		zip.add(entry);
		entry.push(data, true);
		await writing;
		if (failure) throw failure;
	};

	try {
		await add('manifest.json', strToU8(`${JSON.stringify(manifest, null, 2)}\n`));
		for (const file of files) {
			const data = new Uint8Array(await readFile(file.path));
			await add(file.name, data);
		}
		zip.end();
		await zipDone;
		await writing;
		if (failure) throw failure;
		out.end();
		await once(out, 'finish');
	} catch (error) {
		out.destroy(error instanceof Error ? error : new Error(String(error)));
		throw error;
	}
}
