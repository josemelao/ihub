import { readFile } from 'node:fs/promises';
import { strFromU8, unzipSync } from 'fflate';
import { expect, test } from './fixtures';

const snapshot = {
	item: {
		id: 'e2e-post',
		sourceId: 'e2e-fonte',
		title: 'Post de teste E2E',
		summary: 'Resumo do post de teste.',
		url: 'https://example.com/post-e2e',
		publishedAt: '2026-01-01T00:00:00.000Z',
		thumbnail: null
	},
	sourceId: 'e2e-fonte',
	sourceName: 'Fonte E2E',
	savedAt: '2026-01-02T00:00:00.000Z'
};

test('exporta salvos e destaques em Markdown (ZIP)', async ({ page }) => {
	const save = await page.request.post('/api/state', {
		data: { action: 'save', id: 'e2e-post', snapshot }
	});
	expect(save.ok()).toBe(true);

	const highlight = await page.request.post('/api/highlights', {
		data: {
			action: 'save',
			itemId: 'e2e-post',
			quote: 'trecho exportado',
			note: 'nota exportada',
			color: 'yellow'
		}
	});
	expect(highlight.ok()).toBe(true);
	const highlightId = ((await highlight.json()) as { highlights: { highlights: { id: string }[] } })
		.highlights.highlights[0].id;

	await page.goto('/gerenciar?tab=backups');
	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('link', { name: /Exportar salvos em Markdown/i }).click();
	const download = await downloadPromise;
	const path = await download.path();
	expect(path).toBeTruthy();

	const zip = unzipSync(new Uint8Array(await readFile(path!)));
	const names = Object.keys(zip);
	expect(names).toContain('index.md');

	const note = names.find((name) => name.endsWith('.md') && name !== 'index.md');
	expect(note).toBeDefined();
	const content = strFromU8(zip[note!]);
	expect(content).toContain('url: "https://example.com/post-e2e"');
	expect(content).toContain('trecho exportado');
	expect(content).toContain('nota exportada');
	expect(content).toContain('- "jogos"');

	// Limpa o estado para os testes seguintes.
	await page.request.post('/api/highlights', {
		data: { action: 'delete', id: highlightId }
	});
	await page.request.post('/api/state', {
		data: { action: 'unsave', id: 'e2e-post' }
	});
});
