import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkPort, logStartup } from '../../scripts/start-lib.mjs';
import { ensureFile } from '../../scripts/setup-lib.mjs';

let dir: string;

beforeAll(() => {
	dir = mkdtempSync(join(tmpdir(), 'ihub-startup-'));
});

afterAll(() => {
	rmSync(dir, { recursive: true, force: true });
});

describe('logStartup', () => {
	it('writes a timestamped line to the data directory', () => {
		const dataDir = join(dir, 'data');
		const line = logStartup('falha de teste', dataDir);

		expect(line).toContain('falha de teste');
		expect(readFileSync(join(dataDir, 'autostart.log'), 'utf8')).toContain('falha de teste');
	});

	it('does not throw when the directory cannot be created', () => {
		const invalid = join(dir, 'arquivo.txt');
		writeFileSync(invalid, 'x');
		expect(() => logStartup('sem diretório', invalid)).not.toThrow();
	});
});

describe('checkPort', () => {
	it('detects an occupied port', async () => {
		const server: Server = createServer();
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		const address = server.address();
		const port = typeof address === 'object' && address ? address.port : 0;

		await expect(checkPort('127.0.0.1', port)).resolves.toBe(true);
		await new Promise<void>((resolve) => server.close(() => resolve()));
	});

	it('returns false for a free port', async () => {
		const server: Server = createServer();
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		const address = server.address();
		const port = typeof address === 'object' && address ? address.port : 0;
		await new Promise<void>((resolve) => server.close(() => resolve()));

		await expect(checkPort('127.0.0.1', port, 200)).resolves.toBe(false);
	});
});

describe('ensureFile', () => {
	it('copies only when the destination is missing', () => {
		const source = join(dir, 'source.json');
		const target = join(dir, 'nested', 'target.json');
		writeFileSync(source, '{"ok":true}');

		expect(ensureFile(source, target)).toBe(true);
		expect(readFileSync(target, 'utf8')).toBe('{"ok":true}');
		expect(ensureFile(source, target)).toBe(false);
		expect(existsSync(target)).toBe(true);
	});
});
