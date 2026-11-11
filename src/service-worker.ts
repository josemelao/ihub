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
		event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
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
