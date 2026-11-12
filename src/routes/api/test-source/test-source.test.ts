import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPublicText } from '#lib/net/safe-fetch';
import { POST } from './+server';
import type { RequestHandler } from './$types';

vi.mock('#lib/net/safe-fetch', async (importOriginal) => {
	const actual = await importOriginal<typeof import('#lib/net/safe-fetch')>();
	return { ...actual, fetchPublicText: vi.fn() };
});

const fetchTextMock = vi.mocked(fetchPublicText);

const rss = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item><title>Patch 1</title><link>https://exemplo.test/1</link><guid>1</guid><description>patch</description></item>
  <item><title>Notícia 2</title><link>https://exemplo.test/2</link><guid>2</guid><description>outra</description></item>
  <item><title>Patch 3</title><link>https://exemplo.test/3</link><guid>3</guid><description>patch</description></item>
</channel></rss>`;

function event(body: unknown): Parameters<RequestHandler>[0] {
	return {
		request: new Request('http://127.0.0.1/api/test-source', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		}),
		url: new URL('http://127.0.0.1/api/test-source')
	} as Parameters<RequestHandler>[0];
}

beforeEach(() => {
	fetchTextMock.mockReset();
	fetchTextMock.mockResolvedValue({ text: rss, finalUrl: 'https://exemplo.test/feed' });
});

describe('POST /api/test-source', () => {
	it('devolve contagem e os primeiros títulos', async () => {
		const response = await POST(event({ type: 'rss', target: 'https://exemplo.test/feed' }));
		const body = (await response.json()) as {
			ok: boolean;
			total: number;
			filtered: number;
			titles: string[];
		};

		expect(response.status).toBe(200);
		expect(body).toMatchObject({ ok: true, total: 3, filtered: 3 });
		expect(body.titles).toEqual(['Patch 1', 'Notícia 2', 'Patch 3']);
	});

	it('aplica as regras include/exclude na contagem', async () => {
		const response = await POST(
			event({
				type: 'rss',
				target: 'https://exemplo.test/feed',
				include: ['patch'],
				matchMode: 'any'
			})
		);
		const body = (await response.json()) as { total: number; filtered: number };

		expect(body.total).toBe(3);
		expect(body.filtered).toBe(2);
	});

	it('responde 400 sem target', async () => {
		const response = await POST(event({ type: 'rss' }));
		expect(response.status).toBe(400);
	});

	it('explica quando o conteúdo não é um feed', async () => {
		fetchTextMock.mockResolvedValue({
			text: '<html><body>site</body></html>',
			finalUrl: 'https://exemplo.test/'
		});

		const response = await POST(event({ type: 'rss', target: 'https://exemplo.test/' }));
		const body = (await response.json()) as { ok: boolean; error: string };

		expect(response.status).toBe(422);
		expect(body.ok).toBe(false);
		expect(body.error).toMatch(/feed/i);
	});

	it('não grava nada no cache', async () => {
		await POST(event({ type: 'rss', target: 'https://exemplo.test/feed' }));

		expect(fetchTextMock).toHaveBeenCalledTimes(1);
	});

	it('explica URL inválida sem virar 500', async () => {
		fetchTextMock.mockRejectedValue(new TypeError('Failed to parse URL from abc'));

		const response = await POST(event({ type: 'rss', target: 'abc' }));
		const body = (await response.json()) as { ok: boolean; error: string };

		expect(response.status).toBe(422);
		expect(body.error).toMatch(/URL inválida/i);
	});
});
