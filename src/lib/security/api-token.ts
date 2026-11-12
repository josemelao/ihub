import { timingSafeEqual } from 'node:crypto';

/** Rotas mutáveis da API exigem token quando `HUB_API_TOKEN` está definido. */
export function requiresApiToken(method: string, pathname: string): boolean {
	if (!pathname.startsWith('/api/')) return false;
	return method !== 'GET' && method !== 'HEAD';
}

export function isAuthorized(authorization: string | null, expected: string): boolean {
	if (!expected) return true;
	if (!authorization) return false;

	const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
	if (!match) return false;

	const provided = Buffer.from(match[1], 'utf8');
	const wanted = Buffer.from(expected, 'utf8');
	if (provided.length !== wanted.length) return false;

	return timingSafeEqual(provided, wanted);
}
