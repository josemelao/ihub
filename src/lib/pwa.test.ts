import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const staticFile = (path: string) => join(root, 'static', path);

function readStatic(path: string): string {
	return readFileSync(staticFile(path), 'utf8');
}

function pngSize(path: string): { width: number; height: number } {
	const buffer = readFileSync(staticFile(path));
	expect(buffer.subarray(1, 4).toString('ascii')).toBe('PNG');
	return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

describe('PWA manifest', () => {
	it('declares the installable app fields', () => {
		const manifest = JSON.parse(readStatic('manifest.webmanifest')) as {
			name: string;
			short_name: string;
			start_url: string;
			scope: string;
			display: string;
			theme_color: string;
			background_color: string;
			icons: { src: string; sizes: string; type: string; purpose?: string }[];
		};

		expect(manifest.name).toBe('Meu Hub');
		expect(manifest.start_url).toBe('/');
		expect(manifest.scope).toBe('/');
		expect(manifest.display).toBe('standalone');
		expect(manifest.theme_color).toBe('#0F1115');
		expect(manifest.background_color).toBe('#0F1115');
		expect(manifest.icons.some((icon) => icon.sizes === '192x192')).toBe(true);
		expect(manifest.icons.some((icon) => icon.sizes === '512x512')).toBe(true);
	});

	it('ships icons with the declared dimensions', () => {
		const manifest = JSON.parse(readStatic('manifest.webmanifest')) as {
			icons: { src: string; sizes: string }[];
		};

		for (const icon of manifest.icons) {
			const path = icon.src.replace(/^\//, '');
			expect(existsSync(staticFile(path))).toBe(true);
			const [width, height] = icon.sizes.split('x').map(Number);
			expect(pngSize(path)).toEqual({ width, height });
		}
	});

	it('links the manifest and registers the service worker', () => {
		expect(readFileSync(join(root, 'src', 'app.html'), 'utf8')).toContain(
			'rel="manifest" href="/manifest.webmanifest"'
		);
		expect(readFileSync(join(root, 'src', 'routes', '+layout.svelte'), 'utf8')).toContain(
			"serviceWorker.register('/service-worker.js')"
		);
		expect(readFileSync(join(root, 'src', 'lib', 'security', 'headers.ts'), 'utf8')).toContain(
			"worker-src 'self'"
		);
	});
});

describe('offline page', () => {
	it('explains how to bring the local server back', () => {
		const html = readStatic('offline.html');

		expect(html).toContain('Meu Hub está offline');
		expect(html).toContain('npm start');
		expect(html).toContain('#0F1115');
	});
});

describe('service worker', () => {
	const readWorker = () => readFileSync(join(root, 'src', 'service-worker.ts'), 'utf8');

	it('handles install, activate and fetch', () => {
		const sw = readWorker();

		expect(sw).toContain("addEventListener('install'");
		expect(sw).toContain("addEventListener('activate'");
		expect(sw).toContain("addEventListener('fetch'");
		expect(sw).toContain('/offline.html');
	});

	it('versions the cache with the build version', () => {
		const sw = readWorker();

		expect(sw).toContain("from '$app/env'");
		expect(sw).toContain('/_app/immutable/');
		expect(sw).toContain('${version}');
	});

	it('drops caches from older builds', () => {
		const sw = readWorker();

		expect(sw).toContain('startsWith(CACHE_PREFIX)');
		expect(sw).toContain('caches.delete(key)');
	});

	it('bounds the number of cached entries', () => {
		const sw = readWorker();

		expect(sw).toContain('MAX_ENTRIES');
		expect(sw).toContain('trimCache');
	});

	it('never caches API or non-GET requests', () => {
		const sw = readWorker();

		expect(sw).toContain("request.method !== 'GET'");
		expect(sw).toContain("pathname.startsWith('/api/')");
		expect(sw).not.toContain("cache.put('/api");
	});

	it('only caches the static shell', () => {
		const sw = readWorker();

		expect(sw).toContain("pathname.startsWith('/_app/immutable/')");
		expect(sw).toContain("pathname.startsWith('/icons/')");
		expect(sw).toContain("pathname === '/manifest.webmanifest'");
	});
});
