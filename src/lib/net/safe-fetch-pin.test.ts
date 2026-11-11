import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { fetchPublicText, isPrivateIp } from './safe-fetch';

vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }));
vi.mock('node:https', () => ({ request: vi.fn() }));
vi.mock('node:http', () => ({ request: vi.fn() }));

const lookupMock = vi.mocked(lookup);
const httpsMock = vi.mocked(httpsRequest);
const httpMock = vi.mocked(httpRequest);

function fakeRequest(body: string) {
	return (
		_options: unknown,
		callback: (response: EventEmitter & Record<string, unknown>) => void
	) => {
		const request = new EventEmitter() as EventEmitter & Record<string, unknown>;
		request.setTimeout = vi.fn();
		request.destroy = vi.fn();
		request.end = vi.fn(() => {
			const response = new EventEmitter() as EventEmitter & Record<string, unknown>;
			response.statusCode = 200;
			response.headers = { 'content-type': 'application/xml' };
			callback(response);
			response.emit('data', Buffer.from(body));
			response.emit('end');
		});
		return request;
	};
}

afterEach(() => {
	vi.clearAllMocks();
});

describe('isPrivateIp com IPv6 mapeado', () => {
	const privados = [
		'::1',
		'fd00::1',
		'fe80::1',
		'::ffff:127.0.0.1',
		'::ffff:7f00:1',
		'::ffff:10.0.0.1',
		'::ffff:a00:1',
		'0:0:0:0:0:ffff:7f00:1',
		'64:ff9b::7f00:1',
		'2002:7f00:0001::'
	];

	const publicos = ['2606:4700:4700::1111', '::ffff:8.8.8.8', '2001:4860:4860::8888'];

	it.each(privados)('bloqueia %s', (address) => {
		expect(isPrivateIp(address)).toBe(true);
	});

	it.each(publicos)('libera %s', (address) => {
		expect(isPrivateIp(address)).toBe(false);
	});
});

describe('fetchPublicText pinando o IP validado', () => {
	it('conecta no IP resolvido, não numa segunda resolução', async () => {
		lookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);
		httpsMock.mockImplementation(fakeRequest('<rss version="2.0"/>') as never);

		const result = await fetchPublicText('https://example.test/feed');

		expect(result.text).toBe('<rss version="2.0"/>');
		expect(lookupMock).toHaveBeenCalledTimes(1);
		expect(httpsMock).toHaveBeenCalledTimes(1);

		const options = httpsMock.mock.calls[0][0] as unknown as {
			lookup: (
				host: string,
				opts: unknown,
				cb: (err: unknown, address: string, family: number) => void
			) => void;
		};
		const callback = vi.fn();
		options.lookup('example.test', {}, callback);
		expect(callback).toHaveBeenCalledWith(null, '93.184.216.34', 4);
	});

	it('recusa o host antes de conectar quando o DNS aponta para IP privado', async () => {
		lookupMock.mockResolvedValue([{ address: '10.0.0.5', family: 4 }] as never);
		httpsMock.mockImplementation(fakeRequest('<rss/>') as never);
		httpMock.mockImplementation(fakeRequest('<rss/>') as never);

		await expect(fetchPublicText('https://interno.test/feed')).rejects.toThrow(/interno/i);
		expect(httpsMock).not.toHaveBeenCalled();
		expect(httpMock).not.toHaveBeenCalled();
	});

	it('revalida o destino de cada redirecionamento', async () => {
		lookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);
		httpsMock.mockImplementation(((options: { hostname?: string }, callback: never) => {
			if (options.hostname === 'publico.test') {
				const request = new EventEmitter() as EventEmitter & Record<string, unknown>;
				request.setTimeout = vi.fn();
				request.destroy = vi.fn();
				request.end = vi.fn(() => {
					const response = new EventEmitter() as EventEmitter & Record<string, unknown>;
					response.statusCode = 302;
					response.headers = { location: 'https://privado.test/feed' };
					(callback as unknown as (res: unknown) => void)(response);
					response.emit('end');
				});
				return request;
			}
			return fakeRequest('<rss/>')(options, callback);
		}) as never);

		lookupMock.mockImplementation((async (host: string) =>
			host === 'privado.test'
				? [{ address: '192.168.0.10', family: 4 }]
				: [{ address: '93.184.216.34', family: 4 }]) as never);

		await expect(fetchPublicText('https://publico.test/feed')).rejects.toThrow(/interno/i);
	});
});
