import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { archiveItem, deleteArchive, MAX_ARCHIVES } from './service';
import { EMPTY_ARCHIVE_INDEX } from '../defaults';
import { readArchiveDocument, writeArchiveDocument } from './store';
import type { ArchiveEntry, ArchiveIndex, FeedItem } from '../types';

const item: FeedItem = {
	id: 'abc',
	sourceId: 's',
	title: 'Post',
	summary: '',
	url: 'https://e.com/post',
	publishedAt: '',
	thumbnail: null
};

let dir: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), 'ihub-archive-job-'));
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

function fakeStorage(initial: ArchiveIndex = structuredClone(EMPTY_ARCHIVE_INDEX)) {
	let index = initial;
	return {
		loadArchiveIndex: vi.fn(async () => index),
		updateArchiveIndex: vi.fn(async (fn: (data: ArchiveIndex) => ArchiveIndex) => {
			index = fn(index);
			return index;
		}),
		saveArchiveIndex: vi.fn(async (data: ArchiveIndex) => {
			index = data;
		}),
		get: () => index
	};
}

const entry = (id: string, status: ArchiveEntry['status']): ArchiveEntry => ({
	id,
	status,
	title: id,
	url: `https://e.com/${id}`,
	bytes: 0,
	assets: 0,
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z'
});

describe('archiveItem', () => {
	it('arquiva HTML + imagem e marca ready', async () => {
		const storage = fakeStorage();
		const deps = {
			text: async () => ({
				text: `<html><body><p>${'texto '.repeat(30)}</p><img src="/a.png"></body></html>`,
				finalUrl: 'https://e.com/post'
			}),
			bytes: async () => ({ bytes: new Uint8Array([1, 2]), contentType: 'image/png' })
		};

		const result = await archiveItem(
			storage as never,
			{ item, title: 'Post', sourceType: 'rss' },
			{ ...deps, archiveRoot: dir }
		);

		expect(result.status).toBe('ready');
		expect(result.assets).toBe(1);
		expect(await readArchiveDocument(join(dir, 'abc'))).toContain('texto');
	});

	it('marca failed quando o body não tem conteúdo suficiente', async () => {
		const storage = fakeStorage();
		const deps = {
			text: async () => ({
				text: '<html><body><p>oi</p></body></html>',
				finalUrl: 'https://e.com/'
			})
		};

		const result = await archiveItem(
			storage as never,
			{ item, title: 'Post', sourceType: 'rss' },
			{ ...deps, archiveRoot: dir }
		);

		expect(result.status).toBe('failed');
	});

	it('marca failed e não grava quando o download falha', async () => {
		const storage = fakeStorage();
		const deps = {
			text: async () => {
				throw new Error('HTTP 404');
			}
		};

		const result = await archiveItem(
			storage as never,
			{ item, title: 'Post', sourceType: 'rss' },
			{ ...deps, archiveRoot: dir }
		);

		expect(result.status).toBe('failed');
		expect(result.error).toContain('404');
	});

	it('recusa quando o teto de arquivos foi atingido', async () => {
		const entries: Record<string, ArchiveEntry> = {};
		for (let index = 0; index < MAX_ARCHIVES; index += 1) {
			entries[`id${index}`] = entry(`id${index}`, 'ready');
		}
		const storage = fakeStorage({ version: 1, entries });

		const result = await archiveItem(
			storage as never,
			{ item, title: 'Post', sourceType: 'rss' },
			{ archiveRoot: dir }
		);

		expect(result.status).toBe('failed');
		expect(result.error).toMatch(/Limite/i);
	});

	it('não arquiva fonte que não é RSS', async () => {
		const storage = fakeStorage();
		const result = await archiveItem(
			storage as never,
			{ item, title: 'Post', sourceType: 'youtube' },
			{ archiveRoot: dir }
		);

		expect(result.status).toBe('failed');
		expect(result.error).toMatch(/RSS/i);
	});
});

describe('deleteArchive', () => {
	it('remove a pasta e a entrada', async () => {
		const storage = fakeStorage({ version: 1, entries: { abc: entry('abc', 'ready') } });
		await archiveItem(
			storage as never,
			{ item, title: 'Post', sourceType: 'rss' },
			{
				archiveRoot: dir,
				text: async () => ({
					text: `<html><body><p>${'texto '.repeat(30)}</p></body></html>`,
					finalUrl: 'https://e.com/post'
				})
			}
		);

		await writeArchiveDocument(join(dir, 'abc'), '<p>x</p>');
		expect(await deleteArchive(storage as never, 'abc', { archiveRoot: dir })).toBe(true);
		expect(storage.get().entries.abc).toBeUndefined();
		expect(await readArchiveDocument(join(dir, 'abc'))).toBeNull();
	});
});
