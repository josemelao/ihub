import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getOrFetchIcon, iconCandidates } from './cache';

let dir: string;
const now = () => new Date('2026-01-02T00:00:00.000Z');

function png(): Uint8Array {
	return new Uint8Array([1, 2, 3]);
}

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), 'meu-hub-icons-'));
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe('iconCandidates', () => {
	it('tenta os favicons comuns de um site', () => {
		expect(iconCandidates('https://example.com')).toEqual([
			'https://example.com/favicon.ico',
			'https://example.com/favicon.png',
			'https://example.com/apple-touch-icon.png'
		]);
	});

	it('usa a URL exata quando é um arquivo de ícone', () => {
		expect(iconCandidates('https://example.com/icone.png')).toEqual([
			'https://example.com/icone.png'
		]);
	});

	it('ignora esquemas inválidos', () => {
		expect(iconCandidates('file:///c:/icone.png')).toEqual([]);
		expect(iconCandidates('nao-e-url')).toEqual([]);
	});
});

describe('getOrFetchIcon', () => {
	it('baixa uma vez e serve do cache depois', async () => {
		const fetchBytes = vi.fn(async () => ({ bytes: png(), contentType: 'image/png' }));

		const first = await getOrFetchIcon(dir, 'https://example.com', { fetchBytes, now });
		const second = await getOrFetchIcon(dir, 'https://example.com', {
			fetchBytes: vi.fn(async () => {
				throw new Error('não deveria buscar');
			}),
			now
		});

		expect(first?.contentType).toBe('image/png');
		expect([...(second?.bytes ?? [])]).toEqual([1, 2, 3]);
		expect(fetchBytes).toHaveBeenCalledTimes(1);
	});

	it('cai para o próximo candidato quando o primeiro falha', async () => {
		const fetchBytes = vi.fn(async (url: string) => {
			if (url.endsWith('favicon.ico')) throw new Error('HTTP 404');
			return { bytes: png(), contentType: 'image/png' };
		});

		const icon = await getOrFetchIcon(dir, 'https://example.com', { fetchBytes, now });

		expect(icon?.contentType).toBe('image/png');
		expect(fetchBytes).toHaveBeenCalledTimes(2);
	});

	it('guarda o miss por 7 dias e tenta de novo depois', async () => {
		const failing = vi.fn(async () => {
			throw new Error('HTTP 404');
		});

		expect(
			await getOrFetchIcon(dir, 'https://example.com', { fetchBytes: failing, now })
		).toBeNull();
		expect(failing).toHaveBeenCalledTimes(3);

		const recent = vi.fn(async () => ({ bytes: png(), contentType: 'image/png' }));
		expect(
			await getOrFetchIcon(dir, 'https://example.com', {
				fetchBytes: recent,
				now: () => new Date('2026-01-03T00:00:00.000Z')
			})
		).toBeNull();
		expect(recent).not.toHaveBeenCalled();

		const later = vi.fn(async () => ({ bytes: png(), contentType: 'image/png' }));
		const icon = await getOrFetchIcon(dir, 'https://example.com', {
			fetchBytes: later,
			now: () => new Date('2026-01-10T00:00:00.000Z')
		});
		expect(icon?.contentType).toBe('image/png');
		expect(later).toHaveBeenCalledTimes(1);
	});

	it('devolve null para fonte inválida sem chamar a rede', async () => {
		const fetchBytes = vi.fn();
		expect(await getOrFetchIcon(dir, 'file:///c:/a.png', { fetchBytes, now })).toBeNull();
		expect(fetchBytes).not.toHaveBeenCalled();
	});
});
