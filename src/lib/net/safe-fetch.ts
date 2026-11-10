import { lookup } from 'node:dns/promises';

export function isPrivateIp(address: string): boolean {
	const value = address.replace(/^\[|\]$/g, '').toLowerCase();

	if (value.includes(':')) {
		if (value === '::1' || value === '::') return true;
		if (/^f[cd]/.test(value)) return true; // unique local fc00::/7
		if (/^fe[89ab]/.test(value)) return true; // link local fe80::/10
		const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
		if (mapped) return isPrivateIp(mapped[1]);
		return false;
	}

	const parts = value.split('.').map(Number);
	if (
		parts.length !== 4 ||
		parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
	) {
		return true;
	}

	const [a, b] = parts;
	return (
		a === 0 ||
		a === 10 ||
		a === 127 ||
		a >= 224 ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 168) ||
		(a === 100 && b >= 64 && b <= 127) ||
		(a === 198 && b >= 18 && b <= 19)
	);
}

export async function assertSafeUrl(input: string | URL): Promise<URL> {
	const url = input instanceof URL ? input : new URL(input);

	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new Error('Use uma URL http:// ou https://.');
	}

	const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
	if (!host) throw new Error('URL sem host.');
	if (host === 'localhost' || host.endsWith('.localhost')) {
		throw new Error('Host interno não permitido.');
	}

	let addresses: { address: string }[];
	try {
		addresses = await lookup(host, { all: true, verbatim: true });
	} catch {
		throw new Error('Não foi possível resolver o host.');
	}

	if (addresses.length === 0 || addresses.some((entry) => isPrivateIp(entry.address))) {
		throw new Error('Host interno não permitido.');
	}

	return url;
}

export function isAllowedContentType(contentType: string | null): boolean {
	if (!contentType) return true;
	const type = contentType.split(';')[0].trim().toLowerCase();
	return (
		type === 'text/html' ||
		type === 'application/xhtml+xml' ||
		type === 'text/plain' ||
		type.includes('xml')
	);
}

export async function readTextLimited(response: Response, maxBytes: number): Promise<string> {
	if (!response.body) return '';

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let received = 0;

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (!value) continue;
			received += value.byteLength;
			if (received > maxBytes) {
				await reader.cancel().catch(() => undefined);
				throw new Error('Resposta muito grande.');
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}

	const total = chunks.reduce((size, chunk) => size + chunk.byteLength, 0);
	const merged = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		merged.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return new TextDecoder().decode(merged);
}

export interface FetchTextOptions {
	maxBytes?: number;
	timeoutMs?: number;
	fetcher?: (input: string, init?: RequestInit) => Promise<Response>;
}

export async function fetchPublicText(
	target: string,
	options: FetchTextOptions = {}
): Promise<{ text: string; finalUrl: string }> {
	const fetcher = options.fetcher ?? fetch;
	const maxBytes = options.maxBytes ?? 5_000_000;
	const timeoutMs = options.timeoutMs ?? 10_000;

	let current = new URL(target);

	for (let redirects = 0; redirects < 4; redirects += 1) {
		await assertSafeUrl(current);

		const response = await fetcher(current.toString(), {
			redirect: 'manual',
			headers: {
				'user-agent': 'MeuHub/0.1 (hub pessoal local)',
				accept: 'text/html, application/rss+xml, application/atom+xml, application/xml, */*'
			},
			signal: AbortSignal.timeout(timeoutMs)
		});

		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get('location');
			if (!location) throw new Error('Redirecionamento sem destino.');
			current = new URL(location, current);
			continue;
		}

		if (!response.ok) throw new Error(`HTTP ${response.status}`);

		const contentType = response.headers.get('content-type');
		if (!isAllowedContentType(contentType)) {
			throw new Error(`Tipo de conteúdo não suportado: ${contentType}`);
		}

		const text = await readTextLimited(response, maxBytes);
		return { text, finalUrl: current.toString() };
	}

	throw new Error('Muitos redirecionamentos.');
}
