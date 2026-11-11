import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const isWindows = process.platform === 'win32';
const scriptsDir = join(process.cwd(), 'scripts');
const tempDirs: string[] = [];

function tempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), 'ihub-env-'));
	tempDirs.push(dir);
	return dir;
}

afterAll(() => {
	for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

describe.skipIf(!isWindows)('autostart endurecido', () => {
	it('loga e sai quando o .env não pode ser lido', () => {
		const cwd = tempDir();
		const dataDir = join(cwd, 'data');
		mkdirSync(join(cwd, '.env'), { recursive: true });

		const result = spawnSync('node', [join(scriptsDir, 'start.mjs')], {
			cwd,
			env: { ...process.env, HUB_DATA_DIR: dataDir, PORT: '5998' },
			encoding: 'utf8'
		});

		expect(result.status).toBe(1);
		expect(readFileSync(join(dataDir, 'autostart.log'), 'utf8')).toContain('.env');
	});

	it('o VBS tenta os caminhos alternativos do Node', () => {
		const vbs = readFileSync(join(scriptsDir, 'start-hidden.vbs'), 'utf8');

		expect(vbs).toContain('%ProgramFiles(x86)%');
		expect(vbs).toContain('%LOCALAPPDATA%');
		expect(vbs).toContain('autostart.log');
	});

	it('o instalador valida a versão mínima do Node', () => {
		const script = readFileSync(join(scriptsDir, 'install-autostart.ps1'), 'utf8');

		expect(script).toMatch(/--version|NodeVersion|\$major/);
		expect(script).toContain('24');
	});
});
