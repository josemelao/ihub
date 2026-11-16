import { describe, expect, it, vi } from 'vitest';
import type { HubItem } from '../types';
import { checkLinks } from './health';

function link(id: string, slug: string): HubItem {
	return {
		id,
		type: 'link',
		name: id,
		url: `https://example.com/${slug}`,
		categoryId: 'cat',
		order: 1,
		pinned: false,
		tags: []
	};
}

function app(id: string): HubItem {
	return {
		id,
		type: 'app',
		name: id,
		launch: { kind: 'protocol', value: 'steam://open/main' },
		categoryId: 'cat',
		order: 1,
		pinned: false,
		tags: []
	};
}

const now = () => new Date('2026-01-02T00:00:00.000Z');

describe('checkLinks', () => {
	it('classifica ok, redirect, 404, 500, timeout e erro de rede', async () => {
		const fetchText = vi.fn(async (url: string) => {
			if (url.endsWith('/ok')) return { text: '', finalUrl: url };
			if (url.endsWith('/redirect')) return { text: '', finalUrl: 'https://example.com/novo' };
			if (url.endsWith('/404')) throw new Error('HTTP 404');
			if (url.endsWith('/500')) throw new Error('HTTP 500');
			if (url.endsWith('/timeout')) throw new Error('The operation was aborted due to timeout');
			throw new Error('fetch failed');
		});

		const data = await checkLinks(
			[
				link('a', 'ok'),
				link('b', 'redirect'),
				link('c', '404'),
				link('d', '500'),
				link('e', 'timeout'),
				link('f', 'rede'),
				app('g')
			],
			{ fetchText, now }
		);

		expect(data.version).toBe(1);
		expect(data.checkedAt).toBe('2026-01-02T00:00:00.000Z');
		expect(data.entries.a).toMatchObject({ status: 'ok', checkedAt: data.checkedAt });
		expect(data.entries.b).toMatchObject({
			status: 'redirect',
			finalUrl: 'https://example.com/novo'
		});
		expect(data.entries.c).toMatchObject({ status: 'broken', code: 404 });
		expect(data.entries.d).toMatchObject({ status: 'error', code: 500 });
		expect(data.entries.e.status).toBe('timeout');
		expect(data.entries.f.status).toBe('error');
		expect(data.entries.g).toBeUndefined();
		expect(fetchText).toHaveBeenCalledTimes(6);
	});

	it('não considera redirect quando a URL normalizada é a mesma', async () => {
		const fetchText = async (url: string) => ({
			text: '',
			finalUrl: `${url.replace('https://example.com', 'https://www.example.com')}/`
		});

		const data = await checkLinks([link('a', 'ok')], { fetchText, now });

		expect(data.entries.a.status).toBe('ok');
	});
});
