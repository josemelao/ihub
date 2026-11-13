import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { brotliCompressSync, deflateSync, gzipSync } from 'node:zlib';
import { discoverFeedUrl } from '#lib/feed/discover';
import { resetHostGate } from './host-gate';
import { fetchPublicText } from './safe-fetch';

vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }));
vi.mock('node:https', () => ({ request: vi.fn() }));
vi.mock('node:http', () => ({ request: vi.fn() }));

const lookupMock = vi.mocked(lookup);
const httpsMock = vi.mocked(httpsRequest);
const httpMock = vi.mocked(httpRequest);

const XML = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><item><title>a</title></item></channel></rss>`;

function fakeResponse(body: Buffer, headers: Record<string, string>, status = 200) {
	return (
		_options: unknown,
		callback: (response: EventEmitter & Record<string, unknown>) => void
	) => {
		const request = new EventEmitter() as EventEmitter & Record<string, unknown>;
		request.setTimeout = vi.fn();
		request.destroy = vi.fn();
		request.end = vi.fn(() => {
			const response = new EventEmitter() as EventEmitter & Record<string, unknown>;
			response.statusCode = status;
			response.headers = headers;
			callback(response);
			response.emit('data', body);
			response.emit('end');
		});
		return request;
	};
}

function serve(body: Buffer, headers: Record<string, string>, status = 200) {
	lookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);
	httpsMock.mockImplementation(fakeResponse(body, headers, status) as never);
	httpMock.mockImplementation(fakeResponse(body, headers, status) as never);
}

beforeEach(() => {
	resetHostGate();
	lookupMock.mockReset();
	httpsMock.mockReset();
	httpMock.mockReset();
});

afterEach(() => {
	vi.clearAllMocks();
});

describe('corpo comprimido (content-encoding)', () => {
	it('descomprime gzip — o caso do GE/G1', async () => {
		serve(gzipSync(Buffer.from(XML)), {
			'content-type': 'application/xml; charset=UTF-8',
			'content-encoding': 'gzip'
		});

		const { text } = await fetchPublicText(
			'https://ge.globo.com/rss/ge/futebol/times/corinthians/'
		);

		expect(text).toContain('<rss');
		expect(text).not.toContain('\u001f');
	});

	it('descomprime deflate', async () => {
		serve(deflateSync(Buffer.from(XML)), {
			'content-type': 'application/xml',
			'content-encoding': 'deflate'
		});

		expect((await fetchPublicText('https://exemplo.test/feed')).text).toContain('<rss');
	});

	it('descomprime brotli', async () => {
		serve(brotliCompressSync(Buffer.from(XML)), {
			'content-type': 'application/rss+xml',
			'content-encoding': 'br'
		});

		expect((await fetchPublicText('https://exemplo.test/feed')).text).toContain('<rss');
	});

	it('aceita múltiplas camadas em ordem inversa', async () => {
		serve(gzipSync(deflateSync(Buffer.from(XML))), {
			'content-type': 'application/xml',
			'content-encoding': 'deflate, gzip'
		});

		expect((await fetchPublicText('https://exemplo.test/feed')).text).toContain('<rss');
	});

	it('cai para o corpo cru quando o header mente', async () => {
		serve(Buffer.from(XML), {
			'content-type': 'application/xml',
			'content-encoding': 'gzip'
		});

		expect((await fetchPublicText('https://exemplo.test/feed')).text).toContain('<rss');
	});

	it('recusa corpo descomprimido acima do limite', async () => {
		serve(gzipSync(Buffer.alloc(6_000_000, 0x61)), {
			'content-type': 'application/xml',
			'content-encoding': 'gzip'
		});

		await expect(
			fetchPublicText('https://exemplo.test/feed', { maxBytes: 5_000_000 })
		).rejects.toThrow(/muito grande/i);
	});

	it('o XML descomprimido passa pelo discoverFeedUrl', async () => {
		serve(gzipSync(Buffer.from(XML)), {
			'content-type': 'application/xml',
			'content-encoding': 'gzip'
		});

		const { text, finalUrl } = await fetchPublicText('https://exemplo.test/feed');

		expect(discoverFeedUrl(text, finalUrl)).toBe('https://exemplo.test/feed');
	});
});

describe('charset do corpo', () => {
	it('decodifica ISO-8859-1 do header — o caso do UOL', async () => {
		serve(Buffer.from('<rss><title>café</title></rss>', 'latin1'), {
			'content-type': 'text/xml;charset=ISO-8859-1'
		});

		expect((await fetchPublicText('https://exemplo.test/feed')).text).toContain('café');
	});

	it('usa o encoding da declaração XML quando o header não informa', async () => {
		serve(Buffer.from('<?xml version="1.0" encoding="ISO-8859-1"?><rss>café</rss>', 'latin1'), {
			'content-type': 'text/xml'
		});

		expect((await fetchPublicText('https://exemplo.test/feed')).text).toContain('café');
	});

	it('cai para UTF-8 quando o label é desconhecido', async () => {
		serve(Buffer.from('<rss>café</rss>', 'utf8'), {
			'content-type': 'text/xml; charset=nao-existe-123'
		});

		expect((await fetchPublicText('https://exemplo.test/feed')).text).toContain('café');
	});
});

describe('backoff após 429', () => {
	it('não insiste no host bloqueado', async () => {
		serve(Buffer.alloc(0), { 'content-type': 'application/xml' }, 429);

		await expect(fetchPublicText('https://www.reddit.com/r/Darktide/.rss')).rejects.toThrow(/429/);
		expect(httpsMock).toHaveBeenCalledTimes(1);

		await expect(fetchPublicText('https://www.reddit.com/r/dota2/.rss')).rejects.toThrow(/429/);
		expect(httpsMock).toHaveBeenCalledTimes(1);
	});

	it('respeita Retry-After em segundos', async () => {
		serve(Buffer.alloc(0), { 'content-type': 'application/xml', 'retry-after': '120' }, 429);

		await expect(fetchPublicText('https://exemplo.test/feed')).rejects.toThrow(/429/);
		await expect(fetchPublicText('https://exemplo.test/feed')).rejects.toThrow(/2 min/);
	});

	it('libera o host depois de uma resposta boa', async () => {
		serve(Buffer.alloc(0), { 'content-type': 'application/xml' }, 429);
		await expect(fetchPublicText('https://exemplo.test/feed')).rejects.toThrow(/429/);

		resetHostGate();
		serve(Buffer.from(XML), { 'content-type': 'application/xml' });

		expect((await fetchPublicText('https://exemplo.test/feed')).text).toContain('<rss');
	});
});
