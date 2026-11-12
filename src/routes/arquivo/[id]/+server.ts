import { join } from 'node:path';
import { assertArchiveId, readArchiveDocument } from '#lib/archive/store';
import { getStorage } from '#lib/storage';
import type { RequestHandler } from './$types';

function archiveRoot(): string {
	return join(process.env.HUB_DATA_DIR ?? 'data', 'archive');
}

export const GET: RequestHandler = async ({ params }) => {
	try {
		assertArchiveId(params.id);
	} catch {
		return new Response('Arquivo inválido.', { status: 400 });
	}

	const entry = (await getStorage().loadArchiveIndex()).entries[params.id];
	if (!entry || entry.status !== 'ready') {
		return new Response('Arquivo não encontrado.', { status: 404 });
	}

	const html = await readArchiveDocument(join(archiveRoot(), params.id));
	if (!html) return new Response('Arquivo não encontrado.', { status: 404 });

	return new Response(html, {
		headers: {
			'content-type': 'text/html; charset=utf-8',
			'cache-control': 'private, max-age=60'
		}
	});
};
