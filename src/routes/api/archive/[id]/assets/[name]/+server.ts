import { join } from 'node:path';
import { assertArchiveId, readArchiveAsset } from '#lib/archive/store';
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

	try {
		const asset = await readArchiveAsset(join(archiveRoot(), params.id), params.name);
		if (!asset) return new Response('Asset não encontrado.', { status: 404 });

		return new Response(asset.bytes as unknown as BodyInit, {
			headers: {
				'content-type': asset.contentType,
				'x-content-type-options': 'nosniff',
				'cache-control': 'private, max-age=31536000, immutable'
			}
		});
	} catch {
		return new Response('Asset inválido.', { status: 400 });
	}
};
