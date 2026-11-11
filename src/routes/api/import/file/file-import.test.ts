import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EMPTY_HUB } from '#lib/defaults';
import type { FileImportPreview } from '#lib/import/file-import';
import { JsonFileStorage } from '#lib/storage/json-file';
import type { RequestHandler } from './$types';

let dir: string;
let previewPOST: RequestHandler;
let applyPOST: RequestHandler;

function event(body: unknown): Parameters<RequestHandler>[0] {
	return {
		request: new Request('http://127.0.0.1/api/import/file', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	} as Parameters<RequestHandler>[0];
}

const BOOKMARKS = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Jogos</H3>
  <DL><p>
    <DT><A HREF="https://example.com/builds">Builds</A>
  </DL><p>
</DL><p>`;

const OPML = `<opml version="2.0"><body>
  <outline text="Jogos">
    <outline text="r/Darktide" type="rss" xmlUrl="https://www.reddit.com/r/Darktide/.rss"/>
  </outline>
</body></opml>`;

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'meu-hub-file-import-'));
	process.env.HUB_DATA_DIR = dir;
	await new JsonFileStorage(dir).saveHub(structuredClone(EMPTY_HUB));
	({ POST: previewPOST } = await import('./preview/+server'));
	({ POST: applyPOST } = await import('./apply/+server'));
});

afterAll(async () => {
	delete process.env.HUB_DATA_DIR;
	await rm(dir, { recursive: true, force: true });
});

describe('POST /api/import/file/preview', () => {
	it('returns a summary and samples for bookmarks', async () => {
		const response = await previewPOST(event({ format: 'bookmarks', content: BOOKMARKS }));
		const result = (await response.json()) as { ok: boolean; preview: FileImportPreview };

		expect(response.status).toBe(200);
		expect(result.ok).toBe(true);
		expect(result.preview.format).toBe('bookmarks');
		expect(result.preview.summary.itemsAdded).toBe(1);
		expect(result.preview.samples).toEqual(['Builds']);
	});

	it('rejects an unknown format', async () => {
		const response = await previewPOST(event({ format: 'csv', content: 'a,b' }));
		expect(response.status).toBe(400);
	});

	it('rejects empty content', async () => {
		const response = await previewPOST(event({ format: 'bookmarks', content: '   ' }));
		expect(response.status).toBe(400);
	});
});

describe('POST /api/import/file/apply', () => {
	it('persists imported bookmarks', async () => {
		const response = await applyPOST(event({ format: 'bookmarks', content: BOOKMARKS }));
		const result = (await response.json()) as { ok: boolean; summary: { itemsAdded: number } };

		expect(response.status).toBe(200);
		expect(result.ok).toBe(true);
		expect(result.summary.itemsAdded).toBe(1);

		const hub = await new JsonFileStorage(dir).loadHub();
		expect(hub.items.map((item) => item.name)).toContain('Builds');
		expect(hub.items[0].tags).toContain('importado');
	});

	it('does not duplicate a repeated import', async () => {
		const response = await applyPOST(event({ format: 'bookmarks', content: BOOKMARKS }));
		const result = (await response.json()) as {
			ok: boolean;
			summary: { itemsAdded: number; duplicates: number };
		};

		expect(result.summary.itemsAdded).toBe(0);
		expect(result.summary.duplicates).toBe(1);
	});

	it('imports OPML sources', async () => {
		const response = await applyPOST(event({ format: 'opml', content: OPML }));
		const result = (await response.json()) as { ok: boolean; summary: { sourcesAdded: number } };

		expect(response.status).toBe(200);
		expect(result.summary.sourcesAdded).toBe(1);

		const hub = await new JsonFileStorage(dir).loadHub();
		expect(hub.feedSources[0]).toMatchObject({
			type: 'reddit',
			target: 'https://www.reddit.com/r/Darktide/.rss'
		});
	});
});
