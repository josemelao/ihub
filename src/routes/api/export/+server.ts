import { json } from '@sveltejs/kit';
import { HubValidationError } from '#lib/schema';
import { getStorage } from '#lib/storage';
import { StorageError } from '#lib/storage/errors';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const bundle = await getStorage().exportBundle();
		const body = `${JSON.stringify(bundle, null, 2)}\n`;
		const filename = `hub-export-${new Date().toISOString().slice(0, 10)}.json`;

		return new Response(body, {
			headers: {
				'content-type': 'application/json; charset=utf-8',
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
