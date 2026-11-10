import { json } from '@sveltejs/kit';
import { HubValidationError } from '#lib/schema';
import { getStorage } from '#lib/storage';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const result = await getStorage().deleteBackup(params.id ?? '');
		return json({ ok: true, ...result });
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
