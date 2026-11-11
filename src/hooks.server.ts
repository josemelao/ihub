import type { Handle } from '@sveltejs/kit/hooks';
import { withSecurityHeaders } from '#lib/security/headers';

const ALLOWED_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

function hostname(hostHeader: string | null): string {
	if (!hostHeader) return '';
	try {
		return new URL(`http://${hostHeader}`).hostname;
	} catch {
		return hostHeader;
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	const host = hostname(event.request.headers.get('host'));
	if (host && !ALLOWED_HOSTS.has(host)) {
		return new Response('Host não permitido. Use http://127.0.0.1.', { status: 403 });
	}

	if (event.request.method !== 'GET' && event.request.method !== 'HEAD') {
		const origin = event.request.headers.get('origin');
		if (origin) {
			const originHost = hostname(origin.replace(/^https?:\/\//, ''));
			if (!ALLOWED_HOSTS.has(originHost)) {
				return new Response('Origem não permitida.', { status: 403 });
			}
		}
	}

	const response = await resolve(event);
	return withSecurityHeaders(response);
};
