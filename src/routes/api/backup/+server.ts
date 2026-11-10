import { json } from '@sveltejs/kit';
import { getStorage } from '#lib/storage';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return json(await getStorage().backupInfo());
};

export const POST: RequestHandler = async () => {
	try {
		const backup = await getStorage().backupNow();
		return json({ ok: true, backup });
	} catch (error) {
		return json(
			{ ok: false, error: error instanceof Error ? error.message : String(error) },
			{ status: 500 }
		);
	}
};
