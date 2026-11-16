import { json } from '@sveltejs/kit';
import { checkLinks } from '#lib/links/health';
import { getStorage } from '#lib/storage';
import type { LinkHealthData } from '#lib/types';
import type { RequestHandler } from './$types';

let inFlight: Promise<LinkHealthData> | null = null;

export const GET: RequestHandler = async () => {
	try {
		return json(await getStorage().loadLinkHealth());
	} catch (error) {
		return json(
			{ ok: false, error: error instanceof Error ? error.message : String(error) },
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async () => {
	try {
		const storage = getStorage();
		if (!inFlight) {
			inFlight = (async () => {
				const hub = await storage.loadHub();
				const data = await checkLinks(hub.items);
				await storage.saveLinkHealth(data);
				return data;
			})().finally(() => {
				inFlight = null;
			});
		}

		return json({ ok: true, ...(await inFlight) });
	} catch (error) {
		return json(
			{ ok: false, error: error instanceof Error ? error.message : String(error) },
			{ status: 500 }
		);
	}
};
