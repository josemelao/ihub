import { json } from '@sveltejs/kit';
import { HubValidationError } from '$lib/schema';
import { getStorage } from '$lib/storage';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		return json(await getStorage().loadHub());
	} catch (error) {
		if (error instanceof HubValidationError) {
			return json({ error: error.message, issues: error.issues }, { status: 500 });
		}
		throw error;
	}
};
