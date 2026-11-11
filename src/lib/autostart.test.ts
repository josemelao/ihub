import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const isWindows = process.platform === 'win32';
const scriptsDir = join(process.cwd(), 'scripts');
const installScript = join(scriptsDir, 'install-autostart.ps1');
const uninstallScript = join(scriptsDir, 'uninstall-autostart.ps1');

let startupDir: string;

function runPowerShell(script: string, ...args: string[]): string {
	return execFileSync(
		'powershell.exe',
		['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...args],
		{ encoding: 'utf8' }
	);
}

beforeAll(() => {
	startupDir = mkdtempSync(join(tmpdir(), 'ihub-autostart-'));
});

afterAll(() => {
	rmSync(startupDir, { recursive: true, force: true });
});

describe.skipIf(!isWindows)('autostart no Windows', () => {
	it('ships a hidden launcher for node', () => {
		const vbs = readFileSync(join(scriptsDir, 'start-hidden.vbs'), 'utf8');

		expect(vbs).toContain('start.mjs');
		expect(vbs).toContain('shell.Run command, 0, False');
		expect(vbs).toContain('%ProgramFiles%');
	});

	it('installs and removes the startup shortcut in a custom folder', () => {
		const output = runPowerShell(installScript, '-StartupDir', startupDir);
		const shortcut = join(startupDir, 'Meu Hub.lnk');

		expect(output).toContain('Atalho criado');
		expect(existsSync(shortcut)).toBe(true);
		expect(readFileSync(shortcut).length).toBeGreaterThan(0);

		const removed = runPowerShell(uninstallScript, '-StartupDir', startupDir);
		expect(removed).toContain('Atalho removido');
		expect(existsSync(shortcut)).toBe(false);
	});
});
