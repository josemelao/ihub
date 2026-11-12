import { copyFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const dataDir = join(process.cwd(), '.e2e-data');
const source = join(process.cwd(), 'data', 'hub.example.json');

export default async function globalSetup(): Promise<void> {
	await rm(dataDir, { recursive: true, force: true });
	await mkdir(dataDir, { recursive: true });

	if (!existsSync(source)) throw new Error(`fixture não encontrada: ${source}`);
	await copyFile(source, join(dataDir, 'hub.json'));
}
