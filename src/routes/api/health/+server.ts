import { json } from '@sveltejs/kit';
import { access } from 'node:fs/promises';
import { EMPTY_FEED_CACHE, EMPTY_HUB, EMPTY_NOTES, EMPTY_STATE } from '#lib/defaults';
import { getStorage } from '#lib/storage';
import type { RequestHandler } from './$types';

const dataDir = () => process.env.HUB_DATA_DIR ?? 'data';

/** Diagnóstico local: contagens, escrita e idade do backup — nunca expõe segredos. */
export const GET: RequestHandler = async () => {
	const storage = getStorage();
	const errors: string[] = [];

	const hub = await storage.loadHub().catch((error: unknown) => {
		errors.push(`hub.json: ${error instanceof Error ? error.message : String(error)}`);
		return EMPTY_HUB;
	});
	const state = await storage.loadState().catch((error: unknown) => {
		errors.push(`estado.json: ${error instanceof Error ? error.message : String(error)}`);
		return EMPTY_STATE;
	});
	const cache = await storage.loadFeedCache().catch((error: unknown) => {
		errors.push(`feed-cache.json: ${error instanceof Error ? error.message : String(error)}`);
		return EMPTY_FEED_CACHE;
	});
	const notes = await storage.loadNotes().catch((error: unknown) => {
		errors.push(`notes.json: ${error instanceof Error ? error.message : String(error)}`);
		return EMPTY_NOTES;
	});

	const writable = await access(dataDir(), 2 /* W_OK */)
		.then(() => true)
		.catch(() => false);

	return json(
		{
			ok: errors.length === 0,
			version: process.env.npm_package_version ?? '0.0.1',
			uptimeSeconds: Math.round(process.uptime()),
			dataDir: dataDir(),
			writable,
			counts: {
				categories: hub.categories.length,
				items: hub.items.length,
				sources: hub.feedSources.length,
				saved: state.saved.length,
				notes: notes.notes.length,
				posts: cache.items.length
			},
			feedUpdatedAt: cache.updatedAt,
			errors
		},
		{ headers: { 'cache-control': 'no-store' } }
	);
};
