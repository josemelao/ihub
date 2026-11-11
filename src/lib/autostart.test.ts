import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const isWindows = process.platform === 'win32';
const scriptsDir = join(process.cwd(), 'scripts');

let tempRoot: string;
let tempStartup: string;

function runPowerShell(script: string, ...args: string[]): string {
	return execFileSync(
		'powershell.exe',
		['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...args],
		{ encoding: 'utf8' }
	);
}

function psQuote(value: string): string {
	return `'${value.replace(/'/g, "''")}'`;
}

beforeAll(() => {
	tempRoot = mkdtempSync(join(tmpdir(), 'ihub autostart '));
	tempStartup = join(tempRoot, 'Startup Dir');
	mkdirSync(join(tempRoot, 'scripts'), { recursive: true });
	for (const file of ['install-autostart.ps1', 'uninstall-autostart.ps1', 'start-hidden.vbs']) {
		copyFileSync(join(scriptsDir, file), join(tempRoot, 'scripts', file));
	}
});

afterAll(() => {
	rmSync(tempRoot, { recursive: true, force: true });
});

describe.skipIf(!isWindows)('autostart no Windows', () => {
	it('ships a hidden launcher for node', () => {
		const vbs = readFileSync(join(scriptsDir, 'start-hidden.vbs'), 'utf8');

		expect(vbs).toContain('start.mjs');
		expect(vbs).toContain('shell.Run command, 0, False');
		expect(vbs).toContain('%ProgramFiles%');
	});

	it('installs a shortcut with quoted paths even with spaces', () => {
		const output = runPowerShell(
			join(tempRoot, 'scripts', 'install-autostart.ps1'),
			'-StartupDir',
			tempStartup
		);
		const shortcut = join(tempStartup, 'Meu Hub.lnk');

		expect(output).toContain('Atalho criado');
		expect(existsSync(shortcut)).toBe(true);

		const info = execFileSync(
			'powershell.exe',
			[
				'-NoProfile',
				'-Command',
				`$s=(New-Object -ComObject WScript.Shell).CreateShortcut(${psQuote(shortcut)}); [pscustomobject]@{Target=$s.TargetPath; Arguments=$s.Arguments; WorkingDirectory=$s.WorkingDirectory} | ConvertTo-Json -Compress`
			],
			{ encoding: 'utf8' }
		);
		const parsed = JSON.parse(info.trim()) as {
			Target: string;
			Arguments: string;
			WorkingDirectory: string;
		};

		expect(parsed.Target.toLowerCase()).toContain('wscript.exe');
		expect(parsed.Arguments).toContain('//B');
		expect(parsed.Arguments).toContain(join(tempRoot, 'scripts', 'start-hidden.vbs'));
		expect(parsed.WorkingDirectory.toLowerCase()).toBe(tempRoot.toLowerCase());

		const removed = runPowerShell(
			join(tempRoot, 'scripts', 'uninstall-autostart.ps1'),
			'-StartupDir',
			tempStartup
		);
		expect(removed).toContain('Atalho removido');
		expect(existsSync(shortcut)).toBe(false);
	}, 20_000);

	it('logs a clear failure when the build is missing', () => {
		const cwd = mkdtempSync(join(tmpdir(), 'ihub-nobuild-'));
		const dataDir = join(cwd, 'data');

		try {
			const result = spawnSync('node', [join(scriptsDir, 'start.mjs')], {
				cwd,
				env: { ...process.env, HUB_DATA_DIR: dataDir, PORT: '5999' },
				encoding: 'utf8'
			});

			expect(result.status).toBe(1);
			expect(readFileSync(join(dataDir, 'autostart.log'), 'utf8')).toContain(
				'Build não encontrado'
			);
		} finally {
			rmSync(cwd, { recursive: true, force: true });
		}
	});
});
