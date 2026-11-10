import { json } from '@sveltejs/kit';
import { HubValidationError } from '#lib/schema';
import { getStorage } from '#lib/storage';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const id = params.id ?? '';

	try {
		const bundle = await getStorage().loadBackupBundle(id);

		return new Response(`${JSON.stringify(bundle, null, 2)}\n`, {
			headers: {
				'content-type': 'application/json; charset=utf-8',
				'content-disposition': `attachment; filename="meu-hub-backup-${id}.json"`,
				'cache-control': 'no-store'
			}
		});
	} catch (error) {
		if (error instanceof HubValidationError) {
			return json({ ok: false, error: error.message, issues: error.issues }, { status: 400 });
		}
		return json(
			{ ok: false, error: error instanceof Error ? error.message : String(error) },
			{ status: 500 }
		);
	}
};
