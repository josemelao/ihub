import { lookup } from 'node:dns/promises';
import { request as httpRequest, type IncomingHttpHeaders } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';

function expandIpv6(value: string): string[] | null {
	const normalized = normalizeIpv6(value);
	const [head, tail] = normalized.split('::');
	const left = head ? head.split(':').filter((part) => part !== '') : [];
	const right = tail ? tail.split(':').filter((part) => part !== '') : [];

	if (tail === undefined) {
		const groups = normalized.split(':');
		return groups.length === 8 ? groups : null;
	}

	const missing = 8 - left.length - right.length;
	if (missing < 0) return null;
	return [...left, ...Array.from({ length: missing }, () => '0'), ...right];
}

/** Converte o final IPv4 embutido (`::ffff:8.8.8.8`) em dois grupos hex. */
function normalizeIpv6(value: string): string {
	const match = /^(.*:)(\d+\.\d+\.\d+\.\d+)$/.exec(value);
	if (!match) return value;
	const [a, b, c, d] = match[2].split('.').map(Number);
	const high = ((a << 8) | b).toString(16);
	const low = ((c << 8) | d).toString(16);
	return `${match[1]}${high}:${low}`;
}

function ipv4FromGroups(hi: string, lo: string): string | null {
	const high = Number.parseInt(hi, 16);
	const low = Number.parseInt(lo, 16);
	if (!Number.isFinite(high) || !Number.isFinite(low)) return null;
	return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
}

export function isPrivateIp(address: string): boolean {
	const value = address
		.replace(/^\[|\]$/g, '')
		.trim()
		.toLowerCase();

	if (value.includes(':')) {
		const groups = expandIpv6(value);
		if (!groups) return true;

		const first = Number.parseInt(groups[0], 16);
		if (!Number.isFinite(first)) return true;

		// :: e ::1
		if (groups.every((group) => Number.parseInt(group, 16) === 0)) return true;
		const onlyLoopback = groups.slice(0, 7).every((group) => Number.parseInt(group, 16) === 0);
		if (onlyLoopback && Number.parseInt(groups[7], 16) === 1) return true;

		// fc00::/7 e fe80::/10
		if ((first & 0xfe00) === 0xfc00) return true;
		if ((first & 0xffc0) === 0xfe80) return true;

		// IPv4 mapeado (::ffff:0:0/96) em hexadecimal ou decimal
		const firstFiveZero = groups.slice(0, 5).every((group) => Number.parseInt(group, 16) === 0);
		const sixth = Number.parseInt(groups[5], 16);
		if (firstFiveZero && (sixth === 0xffff || sixth === 0)) {
			const mapped = ipv4FromGroups(groups[6], groups[7]);
			if (mapped) return isPrivateIp(mapped);
		}

		// NAT64 64:ff9b::/96
		if (first === 0x64 && Number.parseInt(groups[1], 16) === 0xff9b) {
			const middleZero = groups.slice(2, 6).every((group) => Number.parseInt(group, 16) === 0);
			if (middleZero) {
				const mapped = ipv4FromGroups(groups[6], groups[7]);
				if (mapped) return isPrivateIp(mapped);
			}
		}

		// 6to4 2002::/16 carrega o IPv4 nos dois grupos seguintes
		if (first === 0x2002) {
			const embedded = ipv4FromGroups(groups[1], groups[2]);
			if (embedded && isPrivateIp(embedded)) return true;
		}

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

interface PinnedAddress {
	address: string;
	family: number;
}

/**
 * Resolve o host uma única vez e devolve um IP público. O IP é o que vai ser
 * usado na conexão, então uma segunda resolução (DNS rebinding) não muda o
 * destino do request.
 */
export async function resolvePublicAddress(input: string | URL): Promise<PinnedAddress> {
	const url = input instanceof URL ? input : new URL(input);

	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new Error('Use uma URL http:// ou https://.');
	}

	const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
	if (!host) throw new Error('URL sem host.');
	if (host === 'localhost' || host.endsWith('.localhost')) {
		throw new Error('Host interno não permitido.');
	}

	const literal = isIP(host);
	if (literal !== 0) {
		if (isPrivateIp(host)) throw new Error('Host interno não permitido.');
		return { address: host, family: literal };
	}

	let addresses: { address: string; family: number }[];
	try {
		addresses = await lookup(host, { all: true, verbatim: true });
	} catch {
		throw new Error('Não foi possível resolver o host.');
	}

	if (addresses.length === 0 || addresses.some((entry) => isPrivateIp(entry.address))) {
		throw new Error('Host interno não permitido.');
	}

	return { address: addresses[0].address, family: addresses[0].family };
}

export async function assertSafeUrl(input: string | URL): Promise<URL> {
	const url = input instanceof URL ? input : new URL(input);
	await resolvePublicAddress(url);
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

interface RawResponse {
	status: number;
	headers: IncomingHttpHeaders;
	body: string;
}

function pinnedLookup(pinned: PinnedAddress) {
	return (_hostname: string, options: unknown, callback: (...args: unknown[]) => void): void => {
		if (typeof options === 'function') {
			(options as (...args: unknown[]) => void)(null, pinned.address, pinned.family);
			return;
		}
		if (options && typeof options === 'object' && (options as { all?: boolean }).all) {
			callback(null, [{ address: pinned.address, family: pinned.family }]);
			return;
		}
		callback(null, pinned.address, pinned.family);
	};
}

function requestPinned(
	url: URL,
	pinned: PinnedAddress,
	options: { timeoutMs: number; maxBytes: number }
): Promise<RawResponse> {
	return new Promise((resolve, reject) => {
		const send = url.protocol === 'https:' ? httpsRequest : httpRequest;
		let settled = false;

		const finish = (fn: () => void) => {
			if (settled) return;
			settled = true;
			fn();
		};

		const request = send(
			{
				protocol: url.protocol,
				hostname: url.hostname.replace(/^\[|\]$/g, ''),
				port: url.port || undefined,
				path: `${url.pathname}${url.search}`,
				method: 'GET',
				headers: {
					'user-agent': 'MeuHub/0.1 (hub pessoal local)',
					accept: 'text/html, application/rss+xml, application/atom+xml, application/xml, */*'
				},
				lookup: pinnedLookup(pinned) as never
			},
			(response) => {
				const chunks: Buffer[] = [];
				let size = 0;

				response.on('data', (chunk: Buffer) => {
					size += chunk.length;
					if (size > options.maxBytes) {
						request.destroy(new Error('Resposta muito grande.'));
						return;
					}
					chunks.push(chunk);
				});
				response.on('end', () =>
					finish(() =>
						resolve({
							status: response.statusCode ?? 0,
							headers: response.headers,
							body: Buffer.concat(chunks).toString('utf8')
						})
					)
				);
				response.on('error', (error) => finish(() => reject(error)));
			}
		);

		request.setTimeout(options.timeoutMs, () =>
			request.destroy(new Error('Tempo esgotado ao buscar o conteúdo.'))
		);
		request.on('error', (error) => finish(() => reject(error)));
		request.end();
	});
}

function headerOf(headers: IncomingHttpHeaders, name: string): string | null {
	const value = headers[name];
	if (Array.isArray(value)) return value[0] ?? null;
	return value ?? null;
}

function fetchTextPinned(
	target: string,
	options: { timeoutMs: number; maxBytes: number }
): Promise<{ text: string; finalUrl: string }> {
	return (async () => {
		let current = new URL(target);

		for (let redirects = 0; redirects < 4; redirects += 1) {
			const pinned = await resolvePublicAddress(current);
			const response = await requestPinned(current, pinned, options);

			if (response.status >= 300 && response.status < 400) {
				const location = headerOf(response.headers, 'location');
				if (!location) throw new Error('Redirecionamento sem destino.');
				current = new URL(location, current);
				continue;
			}

			if (response.status < 200 || response.status >= 300) {
				throw new Error(`HTTP ${response.status}`);
			}

			const contentType = headerOf(response.headers, 'content-type');
			if (!isAllowedContentType(contentType)) {
				throw new Error(`Tipo de conteúdo não suportado: ${contentType}`);
			}

			return { text: response.body, finalUrl: current.toString() };
		}

		throw new Error('Muitos redirecionamentos.');
	})();
}

async function fetchTextWithFetcher(
	target: string,
	options: { timeoutMs: number; maxBytes: number },
	fetcher: (input: string, init?: RequestInit) => Promise<Response>
): Promise<{ text: string; finalUrl: string }> {
	let current = new URL(target);

	for (let redirects = 0; redirects < 4; redirects += 1) {
		await assertSafeUrl(current);

		const response = await fetcher(current.toString(), {
			redirect: 'manual',
			headers: {
				'user-agent': 'MeuHub/0.1 (hub pessoal local)',
				accept: 'text/html, application/rss+xml, application/atom+xml, application/xml, */*'
			},
			signal: AbortSignal.timeout(options.timeoutMs)
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

		const text = await readTextLimited(response, options.maxBytes);
		return { text, finalUrl: current.toString() };
	}

	throw new Error('Muitos redirecionamentos.');
}

export async function fetchPublicText(
	target: string,
	options: FetchTextOptions = {}
): Promise<{ text: string; finalUrl: string }> {
	const maxBytes = options.maxBytes ?? 5_000_000;
	const timeoutMs = options.timeoutMs ?? 10_000;
	const limits = { maxBytes, timeoutMs };

	// Com fetcher injetado (testes), mantém o caminho via Response; em produção
	// a conexão usa o IP já validado.
	if (options.fetcher) return fetchTextWithFetcher(target, limits, options.fetcher);
	return fetchTextPinned(target, limits);
}
