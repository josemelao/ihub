import { json } from '@sveltejs/kit';
import { strToU8, zipSync } from 'fflate';
import { EMPTY_ARCHIVE_INDEX } from '#lib/defaults';
import { buildMarkdownExport } from '#lib/export/markdown';
import { HubValidationError } from '#lib/schema';
import { getStorage } from '#lib/storage';
import { StorageError } from '#lib/storage/errors';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const storage = getStorage();
		const [hub, state, feed, highlights, archives] = await Promise.all([
			storage.loadHub(),
			storage.loadState(),
			storage.loadFeedCache(),
			storage.loadHighlights(),
			storage.loadArchiveIndex().catch(() => EMPTY_ARCHIVE_INDEX)
		]);

		const { files, index } = buildMarkdownExport({
			hub,
			state,
			feed,
			highlights,
			archives,
			baseUrl: url.origin,
			now: new Date()
		});

		const entries: Record<string, Uint8Array> = {};
		for (const file of files) entries[file.name] = strToU8(file.content);
		entries['index.md'] = strToU8(index);

		const zipped = zipSync(entries, { level: 6 });
		const filename = `meu-hub-export-${new Date().toISOString().slice(0, 10)}.zip`;

		return new Response(zipped as unknown as BodyInit, {
			headers: {
				'content-type': 'application/zip',
				'content-disposition': `attachment; filename="${filename}"`,
				'cache-control': 'no-store'
			}
		});
	} catch (error) {
		if (error instanceof HubValidationError) {
			return json({ error: error.message, issues: error.issues }, { status: 500 });
		}
		if (error instanceof StorageError) {
			return json({ error: error.message, code: error.code }, { status: 500 });
		}
		throw error;
	}
};
