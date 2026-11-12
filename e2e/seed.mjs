import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const dataDir = join(root, '.e2e-data');
const now = new Date().toISOString();

await rm(dataDir, { recursive: true, force: true });
await mkdir(dataDir, { recursive: true });

const fixture = JSON.parse(await readFile(join(root, 'data', 'hub.example.json'), 'utf8'));
const categoryId = fixture.categories[0]?.id ?? 'jogos';

// Sem rede no E2E: uma fonte local, já "buscada", para o feed ter um post.
fixture.feedSources = [
	{
		id: 'e2e-fonte',
		type: 'rss',
		name: 'Fonte E2E',
		target: 'https://example.invalid/feed.xml',
		categoryId,
		intervalMinutes: 1440,
		enabled: true,
		include: [],
		exclude: [],
		matchMode: 'any'
	}
];

await writeFile(join(dataDir, 'hub.json'), `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');

const cache = {
	version: 1,
	updatedAt: now,
	items: [
		{
			id: 'e2e-post',
			sourceId: 'e2e-fonte',
			title: 'Post de teste E2E',
			summary: 'Resumo do post de teste.',
			url: 'https://example.com/post-e2e',
			publishedAt: now,
			thumbnail: null
		}
	],
	sources: {
		'e2e-fonte': { lastFetchedAt: now, error: null, count: 1 }
	}
};

await writeFile(join(dataDir, 'feed-cache.json'), `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
await writeFile(
	join(dataDir, 'estado.json'),
	`${JSON.stringify({ version: 1, read: {}, saved: [], savedItems: {} }, null, 2)}\n`,
	'utf8'
);

console.log('[e2e] hub, estado e feed de teste criados em .e2e-data');
