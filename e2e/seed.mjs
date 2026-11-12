import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const dataDir = join(root, '.e2e-data');

await rm(dataDir, { recursive: true, force: true });
await mkdir(dataDir, { recursive: true });

const fixture = JSON.parse(await readFile(join(root, 'data', 'hub.example.json'), 'utf8'));
// Sem fontes no E2E: nada de rede externa nem scheduler buscando feeds.
fixture.feedSources = [];

await writeFile(join(dataDir, 'hub.json'), `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
console.log('[e2e] hub de teste criado em .e2e-data');
