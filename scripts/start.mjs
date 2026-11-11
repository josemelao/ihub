import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { checkPort, logStartup } from './start-lib.mjs';

if (existsSync('.env')) process.loadEnvFile('.env');

process.env.HOST ??= '127.0.0.1';
process.env.PORT ??= '5757';

const host = process.env.HOST;
const port = Number(process.env.PORT);
const build = join(process.cwd(), 'build', 'index.js');

function fail(message) {
	const line = logStartup(message);
	console.error(line.trim());
	process.exit(1);
}

process.on('uncaughtException', (error) => {
	const line = logStartup(`Erro não tratado: ${error.message}`);
	console.error(line.trim());
	process.exit(1);
});

process.on('unhandledRejection', (reason) => {
	const line = logStartup(`Promise rejeitada: ${String(reason)}`);
	console.error(line.trim());
	process.exit(1);
});

if (!existsSync(build)) {
	fail(`Build não encontrado em ${build}. Rode "npm run build" antes de iniciar.`);
}

if (await checkPort(host, port)) {
	const line = logStartup(
		`Porta ${port} já está em uso em ${host}. O hub pode já estar rodando; não iniciei outro processo.`
	);
	console.error(line.trim());
	process.exit(0);
}

try {
	await import('../build/index.js');
} catch (error) {
	fail(`Falha ao iniciar o hub: ${error instanceof Error ? error.message : String(error)}`);
}
