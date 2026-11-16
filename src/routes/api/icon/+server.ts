import { json } from '@sveltejs/kit';
import { getOrFetchIcon } from '#lib/icons/cache';
import type { RequestHandler } from './$types';

const MAX_SOURCE_LENGTH = 2_048;

function invalid(url: string): boolean {
	if (!url || url.length > MAX_SOURCE_LENGTH) return true;
	try {
		const parsed = new URL(url);
		return (
			(parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
			Boolean(parsed.username || parsed.password)
		);
	} catch {
		return true;
	}
}

export const GET: RequestHandler = async ({ url }) => {
	const source = url.searchParams.get('url')?.trim() ?? '';
	if (invalid(source)) {
		return json({ ok: false, error: 'Informe uma URL http(s) válida.' }, { status: 400 });
	}

	try {
		const dataDir = process.env.HUB_DATA_DIR ?? 'data';
		const icon = await getOrFetchIcon(dataDir, source);
		if (!icon) {
			return new Response(null, { status: 404, headers: { 'cache-control': 'no-store' } });
		}

		return new Response(icon.bytes as unknown as BodyInit, {
			headers: {
				'content-type': icon.contentType,
				'content-length': String(icon.bytes.byteLength),
				'cache-control': 'public, max-age=604800, immutable',
				'x-content-type-options': 'nosniff'
			}
		});
	} catch (error) {
		return json(
			{ ok: false, error: error instanceof Error ? error.message : String(error) },
			{ status: 500 }
		);
	}
};
