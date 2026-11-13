import { join } from 'node:path';
import { assertArchiveId, readArchiveDocument } from '#lib/archive/store';
import { getStorage } from '#lib/storage';
import type { ArchiveEntry } from '#lib/types';
import type { RequestHandler } from './$types';

function archiveRoot(): string {
	return join(process.env.HUB_DATA_DIR ?? 'data', 'archive');
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

function notFound(entry?: ArchiveEntry): Response {
	const original = entry?.url
		? `<p><a href="${escapeHtml(entry.url)}" target="_blank" rel="noopener noreferrer">Abrir original</a></p>`
		: '';

	const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Arquivo não encontrado · Meu Hub</title>
<link rel="stylesheet" href="/archive.css">
</head>
<body>
<header class="archive-bar">
	<div class="archive-title"><strong>Arquivo não encontrado</strong></div>
	<nav><a href="/favoritos">Voltar aos salvos</a></nav>
</header>
<main class="archive-body">
	<p>Esta página não tem cópia local disponível. O post pode ter sido removido dos salvos, o arquivamento pode ter falhado ou o arquivo foi apagado.</p>
	${original}
</main>
</body>
</html>
`;

	return new Response(html, {
		status: 404,
		headers: { 'content-type': 'text/html; charset=utf-8' }
	});
}

export const GET: RequestHandler = async ({ params }) => {
	try {
		assertArchiveId(params.id);
	} catch {
		return new Response('Arquivo inválido.', { status: 400 });
	}

	const entry = await getStorage()
		.loadArchiveIndex()
		.then((index) => index.entries[params.id])
		.catch(() => undefined);

	if (!entry || entry.status !== 'ready') return notFound(entry);

	const html = await readArchiveDocument(join(archiveRoot(), params.id)).catch(() => null);
	if (!html) return notFound(entry);

	return new Response(html, {
		headers: {
			'content-type': 'text/html; charset=utf-8',
			'cache-control': 'private, max-age=60'
		}
	});
};
