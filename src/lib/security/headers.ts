export const SECURITY_HEADERS: Record<string, string> = {
	'x-content-type-options': 'nosniff',
	'referrer-policy': 'no-referrer',
	'x-frame-options': 'DENY',
	'permissions-policy': 'camera=(), microphone=(), geolocation=()'
};

export const CONTENT_SECURITY_POLICY = [
	"default-src 'self'",
	"base-uri 'self'",
	"object-src 'none'",
	"frame-ancestors 'none'",
	"form-action 'self'",
	"script-src 'self' 'unsafe-inline'",
	"style-src 'self' 'unsafe-inline'",
	"font-src 'self' data:",
	"img-src 'self' https: data:",
	"connect-src 'self'",
	"worker-src 'self'",
	"frame-src 'self' https://www.youtube-nocookie.com https://www.redditmedia.com",
	"media-src 'self' https:"
].join('; ');

export const ARCHIVE_CONTENT_SECURITY_POLICY = [
	"default-src 'none'",
	"img-src 'self'",
	"style-src 'self'",
	"font-src 'self'",
	"script-src 'none'",
	"connect-src 'none'",
	"base-uri 'none'",
	"form-action 'none'",
	"frame-ancestors 'none'"
].join('; ');

/** Aplica todos os headers de segurança (CSP em modo enforce) numa resposta. */
export function withSecurityHeaders(
	response: Response,
	options: { archive?: boolean } = {}
): Response {
	const headers = new Headers(response.headers);
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		headers.set(name, value);
	}
	headers.set(
		'content-security-policy',
		options.archive ? ARCHIVE_CONTENT_SECURITY_POLICY : CONTENT_SECURITY_POLICY
	);

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}
