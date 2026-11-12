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
		fullText: true,
		enabled: true,
		include: [],
		exclude: [],
		matchMode: 'any'
	},
	{
		id: 'e2e-fonte-off',
		type: 'rss',
		name: 'Fonte E2E sem reader',
		target: 'https://example.invalid/feed-off.xml',
		categoryId,
		intervalMinutes: 1440,
		fullText: false,
		enabled: false,
		include: [],
		exclude: [],
		matchMode: 'any'
	},
	{
		id: 'e2e-fonte-erro',
		type: 'rss',
		name: 'Fonte E2E com erro de extração',
		target: 'https://example.invalid/feed-erro.xml',
		categoryId,
		intervalMinutes: 1440,
		fullText: true,
		enabled: false,
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
		},
		{
			id: 'e2e-post-off',
			sourceId: 'e2e-fonte-off',
			title: 'Post sem texto completo',
			summary: 'Este post está em uma fonte com o reader desligado.',
			url: 'https://example.com/post-e2e-off',
			publishedAt: now,
			thumbnail: null
		},
		{
			id: 'e2e-post-erro',
			sourceId: 'e2e-fonte-erro',
			title: 'Post com extração falhando',
			summary: 'A página deste post não existe.',
			url: 'https://example.invalid/post-erro',
			publishedAt: now,
			thumbnail: null
		}
	],
	sources: {
		'e2e-fonte': { lastFetchedAt: now, error: null, count: 1 },
		'e2e-fonte-off': { lastFetchedAt: now, error: null, count: 1 },
		'e2e-fonte-erro': { lastFetchedAt: now, error: null, count: 1 }
	}
};

await writeFile(join(dataDir, 'feed-cache.json'), `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
await writeFile(
	join(dataDir, 'estado.json'),
	`${JSON.stringify({ version: 1, read: {}, saved: [], savedItems: {} }, null, 2)}\n`,
	'utf8'
);

// Artigo já extraído para o reader do E2E (sem imagens externas).
const readerHtml = [
	'<h2>Seção de teste</h2>',
	'<p>Este é o primeiro parágrafo do artigo de teste do reader.</p>',
	'<p>O segundo parágrafo existe para dar corpo ao texto e permitir selecionar uma frase.</p>',
	'<blockquote>Uma citação para conferir a tipografia de leitura.</blockquote>'
].join('');
const readerText =
	'Seção de teste Este é o primeiro parágrafo do artigo de teste do reader. ' +
	'O segundo parágrafo existe para dar corpo ao texto e permitir selecionar uma frase. ' +
	'Uma citação para conferir a tipografia de leitura.';

await mkdir(join(dataDir, 'reading'), { recursive: true });
await writeFile(
	join(dataDir, 'reading', 'e2e-post.json'),
	`${JSON.stringify(
		{
			id: 'e2e-post',
			url: 'https://example.com/post-e2e',
			finalUrl: 'https://example.com/post-e2e',
			title: 'Post de teste E2E',
			byline: 'Equipe E2E',
			siteName: 'Exemplo',
			excerpt: 'Resumo do post de teste.',
			publishedAt: now,
			fetchedAt: now,
			length: readerText.length,
			html: readerHtml,
			text: readerText
		},
		null,
		2
	)}\n`,
	'utf8'
);

// Página inteira já arquivada (HTML + 1 imagem local).
const archiveAsset = 'a1b2c3d4e5f60718.png';
const archiveHtml = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Post de teste E2E</title><link rel="stylesheet" href="/archive.css"></head>
<body>
<header class="archive-bar"><div class="archive-title"><strong>Post de teste E2E</strong><span>Arquivado em 12/11/2026</span></div><nav><a href="https://example.com/post-e2e" target="_blank" rel="noopener noreferrer">Abrir original</a><a href="/ler/e2e-post">Voltar ao hub</a></nav></header>
<main class="archive-body"><h2>Seção arquivada</h2><p>Conteúdo da página inteira guardado localmente.</p><img src="/api/archive/e2e-post/assets/${archiveAsset}" alt="imagem de teste"></main>
</body></html>
`;

await mkdir(join(dataDir, 'archive', 'e2e-post', 'assets'), { recursive: true });
await writeFile(join(dataDir, 'archive', 'e2e-post', 'index.html'), archiveHtml, 'utf8');
await writeFile(
	join(dataDir, 'archive', 'e2e-post', 'assets', archiveAsset),
	Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
		'base64'
	)
);
await writeFile(
	join(dataDir, 'archive', 'e2e-post', 'assets.json'),
	`${JSON.stringify({ version: 1, assets: { [archiveAsset]: 'image/png' } }, null, 2)}\n`,
	'utf8'
);
await writeFile(
	join(dataDir, 'archive.json'),
	`${JSON.stringify(
		{
			version: 1,
			entries: {
				'e2e-post': {
					id: 'e2e-post',
					status: 'ready',
					title: 'Post de teste E2E',
					url: 'https://example.com/post-e2e',
					bytes: 500,
					assets: 1,
					createdAt: now,
					updatedAt: now
				}
			}
		},
		null,
		2
	)}\n`,
	'utf8'
);

console.log('[e2e] hub, estado, feed, artigo e arquivo criados em .e2e-data');
