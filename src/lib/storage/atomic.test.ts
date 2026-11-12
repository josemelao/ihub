import { describe, expect, it, vi } from 'vitest';
import { writeFileAtomically, type AtomicFileDeps } from './atomic';

function errno(code: string): NodeJS.ErrnoException {
	const error = new Error(`falha ${code}`) as NodeJS.ErrnoException;
	error.code = code;
	return error;
}

function setup(options: { renameErrors?: string[]; copyError?: string } = {}) {
	const files = new Map<string, string>();
	const tempPaths: string[] = [];
	const renames: [string, string][] = [];
	const sleeps: number[] = [];
	let suffix = 0;

	const renameErrors = [...(options.renameErrors ?? [])];

	const deps: AtomicFileDeps = {
		async writeFile(path, data) {
			if (typeof data !== 'string') throw new Error('text only');
			tempPaths.push(path);
			files.set(path, data);
		},
		async readFile(path) {
			const value = files.get(path);
			if (value === undefined) throw errno('ENOENT');
			return value;
		},
		async copyFile(from, to) {
			if (options.copyError) throw errno(options.copyError);
			const value = files.get(from);
			if (value === undefined) throw errno('ENOENT');
			files.set(to, value);
		},
		async rename(from, to) {
			const next = renameErrors.shift();
			if (next) throw errno(next);
			const value = files.get(from);
			if (value === undefined) throw errno('ENOENT');
			files.delete(from);
			files.set(to, value);
			renames.push([from, to]);
		},
		async unlink(path) {
			files.delete(path);
		},
		sleep: async (ms) => {
			sleeps.push(ms);
		},
		uniqueSuffix: () => {
			suffix += 1;
			return `sufixo-${suffix}`;
		}
	};

	return { deps, files, tempPaths, renames, sleeps };
}

describe('writeFileAtomically', () => {
	it('grava via temporÃ¡rio e renomeia', async () => {
		const { deps, files, tempPaths, renames } = setup();
		files.set('dados/hub.json', '{"antigo":true}');

		await writeFileAtomically('dados/hub.json', '{"novo":true}', deps);

		expect(files.get('dados/hub.json')).toBe('{"novo":true}');
		expect(tempPaths[0]).toContain('hub.json.tmp-sufixo-1');
		expect(renames).toEqual([['dados/hub.json.tmp-sufixo-1', 'dados/hub.json']]);
		expect(files.has('dados/hub.json.tmp-sufixo-1')).toBe(false);
	});

	it('faz backup quando o conteÃºdo atual Ã© vÃ¡lido', async () => {
		const { deps, files } = setup();
		files.set('dados/hub.json', '{"antigo":true}');

		await writeFileAtomically('dados/hub.json', '{"novo":true}', deps, {
			backupPath: 'dados/hub.json.bak',
			keepBackup: (raw) => raw.includes('"antigo"')
		});

		expect(files.get('dados/hub.json.bak')).toBe('{"antigo":true}');
	});

	it('nÃ£o faz backup quando o conteÃºdo atual Ã© invÃ¡lido', async () => {
		const { deps, files } = setup();
		files.set('dados/hub.json', '{quebrado');

		await writeFileAtomically('dados/hub.json', '{"novo":true}', deps, {
			backupPath: 'dados/hub.json.bak',
			keepBackup: (raw) => {
				try {
					JSON.parse(raw);
					return true;
				} catch {
					return false;
				}
			}
		});

		expect(files.has('dados/hub.json.bak')).toBe(false);
	});

	it('repete o rename com backoff em EPERM/EBUSY', async () => {
		const { deps, files, sleeps } = setup({ renameErrors: ['EPERM', 'EBUSY'] });
		files.set('dados/hub.json', '{"antigo":true}');

		await writeFileAtomically('dados/hub.json', '{"novo":true}', deps);

		expect(sleeps).toEqual([50, 100]);
		expect(files.get('dados/hub.json')).toBe('{"novo":true}');
	});

	it('cai para copyFile quando o rename nunca funciona', async () => {
		const { deps, files } = setup({
			renameErrors: ['EPERM', 'EPERM', 'EPERM', 'EPERM', 'EPERM', 'EPERM']
		});
		files.set('dados/hub.json', '{"antigo":true}');

		await writeFileAtomically('dados/hub.json', '{"novo":true}', deps);

		expect(files.get('dados/hub.json')).toBe('{"novo":true}');
		expect(files.has('dados/hub.json.tmp-sufixo-1')).toBe(false);
	});

	it('remove o temporÃ¡rio e falha com mensagem clara', async () => {
		const { deps, files } = setup({
			renameErrors: ['EPERM', 'EPERM', 'EPERM', 'EPERM', 'EPERM', 'EPERM'],
			copyError: 'EACCES'
		});

		await expect(writeFileAtomically('dados/hub.json', '{}', deps)).rejects.toThrow(
			/Não foi possível gravar dados\/hub\.json.*EPERM/i
		);
		expect([...files.keys()].some((path) => path.includes('.tmp-'))).toBe(false);
	});

	it('nÃ£o tenta fallback em erro nÃ£o transitÃ³rio', async () => {
		const { deps, files, sleeps } = setup({ renameErrors: ['EIO'] });

		await expect(writeFileAtomically('dados/hub.json', '{}', deps)).rejects.toThrow(/EIO/);
		expect(sleeps).toEqual([]);
		expect([...files.keys()].some((path) => path.includes('.tmp-'))).toBe(false);
	});

	it('ignora ENOENT ao ler o arquivo atual para o backup', async () => {
		const { deps, files } = setup();

		await writeFileAtomically('dados/hub.json', '{"novo":true}', deps, {
			backupPath: 'dados/hub.json.bak',
			keepBackup: () => true
		});

		expect(files.get('dados/hub.json')).toBe('{"novo":true}');
		expect(files.has('dados/hub.json.bak')).toBe(false);
	});

	it('propaga erro de leitura que nÃ£o seja ENOENT', async () => {
		const { deps } = setup();
		const readFile = vi.spyOn(deps, 'readFile').mockRejectedValue(errno('EACCES'));

		await expect(
			writeFileAtomically('dados/hub.json', '{}', deps, {
				backupPath: 'dados/hub.json.bak',
				keepBackup: () => true
			})
		).rejects.toThrow(/EACCES/);
		expect(readFile).toHaveBeenCalled();
	});
});

describe('rotaÃ§Ã£o de backups', () => {
	it('desloca as geraÃ§Ãµes antes de gravar o novo backup', async () => {
		const { deps, files } = setup();
		files.set('dados/hub.json', '{"v":1}');
		files.set('dados/hub.json.bak', '{"v":0}');
		files.set('dados/hub.json.bak.1', '{"v":-1}');

		await writeFileAtomically('dados/hub.json', '{"v":2}', deps, {
			backupPath: 'dados/hub.json.bak',
			backupGenerations: 3
		});

		expect(files.get('dados/hub.json.bak')).toBe('{"v":1}');
		expect(files.get('dados/hub.json.bak.1')).toBe('{"v":0}');
		expect(files.get('dados/hub.json.bak.2')).toBe('{"v":-1}');
	});

	it('mantÃ©m no mÃ¡ximo 7 geraÃ§Ãµes', async () => {
		const { deps, files } = setup();

		for (let index = 0; index < 8; index += 1) {
			files.set('dados/hub.json', `{"v":${index}}`);
			await writeFileAtomically('dados/hub.json', `{"v":${index + 1}}`, deps, {
				backupPath: 'dados/hub.json.bak',
				backupGenerations: 7
			});
		}

		expect(files.get('dados/hub.json.bak')).toBe('{"v":7}');
		expect(files.get('dados/hub.json.bak.6')).toBe('{"v":1}');
		expect(files.has('dados/hub.json.bak.7')).toBe(false);
	});

	it('ignora geraÃ§Ãµes ausentes na rotaÃ§Ã£o', async () => {
		const { deps, files } = setup();
		files.set('dados/hub.json', '{"v":1}');

		await writeFileAtomically('dados/hub.json', '{"v":2}', deps, {
			backupPath: 'dados/hub.json.bak',
			backupGenerations: 7
		});

		expect(files.get('dados/hub.json.bak')).toBe('{"v":1}');
		expect(files.has('dados/hub.json.bak.1')).toBe(false);
	});

	it('grava mesmo quando o backup estÃ¡ bloqueado', async () => {
		const { deps, files } = setup({ copyError: 'EPERM' });
		files.set('dados/hub.json', '{"antigo":true}');

		await writeFileAtomically('dados/hub.json', '{"novo":true}', deps, {
			backupPath: 'dados/hub.json.bak',
			keepBackup: () => true,
			backupGenerations: 7
		});

		expect(files.get('dados/hub.json')).toBe('{"novo":true}');
		expect(files.has('dados/hub.json.bak')).toBe(false);
	});

	it('preserva o backup mais novo quando a rotaÃ§Ã£o falha', async () => {
		const { deps, files } = setup({ copyError: 'EPERM' });
		files.set('dados/hub.json', '{"atual":true}');
		files.set('dados/hub.json.bak', '{"mais-novo":true}');

		await writeFileAtomically('dados/hub.json', '{"novo":true}', deps, {
			backupPath: 'dados/hub.json.bak',
			keepBackup: () => true,
			backupGenerations: 3
		});

		expect(files.get('dados/hub.json.bak')).toBe('{"mais-novo":true}');
		expect(files.get('dados/hub.json')).toBe('{"novo":true}');
	});
});
