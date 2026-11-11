import { version } from '$app/env';
import { assets, immutable, prerendered } from '$app/manifest';
import { self as sw } from '$app/service-worker';

// `version` muda a cada build: o cache antigo é descartado no activate.
const CACHE = `meu-hub-shell-${version}`;
const CACHE_PREFIX = 'meu-hub-shell-';
const OFFLINE_URL = '/offline.html';
const MAX_ENTRIES = 120;

const PRECACHE = new Set<string>([OFFLINE_URL, '/manifest.webmanifest', '/favicon.svg']);
for (const entry of [...immutable, ...assets, ...prerendered]) {
	PRECACHE.add(entry.path.startsWith('/') ? entry.path : `/${entry.path}`);
}

const NAVIGATION_TIMEOUT_MS = 8000;
const OFFLINE_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Meu Hub está offline</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0F1115;color:#E7E9EE;font-family:system-ui,sans-serif;text-align:center;padding:24px}
h1{font-size:20px;margin:0 0 8px}
p{margin:0;color:#A5ADBB}
code{background:#1A1F28;padding:2px 6px;border-radius:6px}
</style>
</head>
<body>
<main>
<h1>Meu Hub está offline</h1>
<p>O servidor local não respondeu. Rode <code>npm start</code> e tente de novo.</p>
</main>
</body>
</html>`;

/** Sempre devolve uma resposta: cache primeiro, HTML embutido como último recurso. */
async function offlineResponse(): Promise<Response> {
	try {
		const cached = await caches.match(OFFLINE_URL);
		if (cached) return cached;
	} catch {
		// cache indisponível: cai para o HTML embutido
	}
	return new Response(OFFLINE_HTML, {
		status: 200,
		headers: { 'content-type': 'text/html; charset=utf-8' }
	});
}

async function navigationResponse(request: Request): Promise<Response> {
	try {
		return await fetch(request, { signal: AbortSignal.timeout(NAVIGATION_TIMEOUT_MS) });
	} catch {
		return offlineResponse();
	}
}

async function trimCache(cacheName: string): Promise<void> {
	const cache = await caches.open(cacheName);
	const keys = await cache.keys();
	if (keys.length <= MAX_ENTRIES) return;
	await Promise.all(keys.slice(0, keys.length - MAX_ENTRIES).map((key) => cache.delete(key)));
}

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll([...PRECACHE]))
			.then(() => trimCache(CACHE))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
						.map((key) => caches.delete(key))
				)
			)
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	const request = event.request;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== sw.location.origin) return;
	if (url.pathname.startsWith('/api/')) return;

	if (request.mode === 'navigate') {
		event.respondWith(navigationResponse(request));
		return;
	}

	const pathname = url.pathname;
	const isStatic =
		pathname.startsWith('/_app/immutable/') ||
		pathname.startsWith('/icons/') ||
		pathname === '/favicon.svg' ||
		pathname === '/manifest.webmanifest';

	if (!isStatic) return;

	event.respondWith(
		caches.match(request).then((cached) => {
			if (cached) return cached;
			return fetch(request).then((response) => {
				if (response.ok) {
					const copy = response.clone();
					void caches
						.open(CACHE)
						.then((cache) => cache.put(request, copy))
						.then(() => trimCache(CACHE));
				}
				return response;
			});
		})
	);
});
