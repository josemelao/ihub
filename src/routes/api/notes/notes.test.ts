import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonFileStorage } from '#lib/storage/json-file';
import { QUICK_NOTE_ID } from '#lib/notes';
import type { GET as NotesGet, POST as NotesPost } from './+server';

let dir: string;
let storage: JsonFileStorage;
let notesGet: typeof NotesGet;
let notesPost: typeof NotesPost;

function event(body: unknown): Parameters<typeof notesPost>[0] {
	return {
		request: new Request('http://127.0.0.1/api/notes', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		}),
		url: new URL('http://127.0.0.1/api/notes')
	} as unknown as Parameters<typeof notesPost>[0];
}

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'meu-hub-notes-api-'));
	process.env.HUB_DATA_DIR = dir;
	storage = new JsonFileStorage(dir);
	({ GET: notesGet, POST: notesPost } = await import('./+server'));
});

afterAll(async () => {
	delete process.env.HUB_DATA_DIR;
	await rm(dir, { recursive: true, force: true });
});

describe('/api/notes', () => {
	it('começa vazio', async () => {
		const response = await notesGet({} as Parameters<typeof notesGet>[0]);
		const body = (await response.json()) as { notes: unknown[] };

		expect(body.notes).toEqual([]);
	});

	it('salva a nota rápida e atualiza em seguida', async () => {
		const first = await notesPost(event({ action: 'save', text: '  lembrar do build  ' }));
		expect(first.status).toBe(200);
		const saved = (await first.json()) as { quick: { id: string; text: string } };
		expect(saved.quick).toMatchObject({ id: QUICK_NOTE_ID, text: 'lembrar do build' });

		const second = await notesPost(event({ action: 'save', text: 'lembrar do patch' }));
		const updated = (await second.json()) as {
			notes: { notes: { id: string; text: string }[] };
		};

		expect(updated.notes.notes).toHaveLength(1);
		expect(updated.notes.notes[0].text).toBe('lembrar do patch');
		expect(await storage.loadNotes()).toMatchObject({
			notes: [{ id: QUICK_NOTE_ID, text: 'lembrar do patch' }]
		});
	});

	it('recusa texto vazio com 400', async () => {
		const response = await notesPost(event({ action: 'save', text: '   ' }));

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({ ok: false });
	});

	it('recusa nota acima de 4.000 caracteres', async () => {
		const response = await notesPost(event({ action: 'save', text: 'x'.repeat(4001) }));

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({ ok: false });
	});

	it('apaga a nota', async () => {
		const response = await notesPost(event({ action: 'delete', id: QUICK_NOTE_ID }));
		const body = (await response.json()) as { notes: { notes: unknown[] } };

		expect(response.status).toBe(200);
		expect(body.notes.notes).toEqual([]);
	});

	it('recusa payload sem action', async () => {
		const response = await notesPost(event({ text: 'oi' }));

		expect(response.status).toBe(400);
	});
});
