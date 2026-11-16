import { json } from '@sveltejs/kit';
import { createReadStream } from 'node:fs';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { collectBackupFiles, writeBackupZip } from '#lib/backup/zip';
import type { RequestHandler } from './$types';

const dataDir = () => process.env.HUB_DATA_DIR ?? 'data';

export const GET: RequestHandler = async ({ url }) => {
	const includeArchive = url.searchParams.get('arquivos') === '1';
	const workDir = await mkdtemp(join(tmpdir(), 'meu-hub-backup-'));
	const target = join(workDir, 'backup.zip');

	try {
		const { files, manifest } = await collectBackupFiles(dataDir(), { includeArchive });
		await writeBackupZip(target, files, manifest);
		const size = (await stat(target)).size;

		const stream = createReadStream(target);
		const cleanup = () => {
			void rm(workDir, { recursive: true, force: true });
		};
		stream.once('close', cleanup);
		stream.once('error', cleanup);

		const filename = `meu-hub-backup-${new Date().toISOString().slice(0, 10)}.zip`;
		return new Response(Readable.toWeb(stream) as unknown as BodyInit, {
			headers: {
				'content-type': 'application/zip',
				'content-disposition': `attachment; filename="${filename}"`,
				'content-length': String(size),
				'cache-control': 'no-store'
			}
		});
	} catch (error) {
		await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
		return json(
			{ ok: false, error: error instanceof Error ? error.message : String(error) },
			{ status: 500 }
		);
	}
};
