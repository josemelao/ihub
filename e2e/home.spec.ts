import { expect, test } from './fixtures';

test('ações rápidas não repetem a navegação e incluem manutenção', async ({ page }) => {
	await page.goto('/');

	const card = page.getByRole('region', { name: 'Ações rápidas' });
	await expect(card.getByRole('button', { name: 'Atualizar agora' })).toBeVisible();
	await expect(card.getByRole('button', { name: 'Backup agora' })).toBeVisible();
	await expect(card.getByRole('link', { name: 'Exportar dados' })).toBeVisible();
	await expect(card.getByRole('link', { name: 'Exportar Markdown' })).toBeVisible();

	// Já existem na sidebar: não devem ocupar espaço na card.
	await expect(card.getByRole('link', { name: 'Ver feed completo' })).toHaveCount(0);
	await expect(card.getByRole('link', { name: 'Favoritos' })).toHaveCount(0);
	await expect(card.getByRole('link', { name: 'Gerenciar' })).toHaveCount(0);
});

test('backup agora cria um ponto de restauração', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Backup agora' }).click();
	await expect(page.getByText('Backup criado.')).toBeVisible({ timeout: 10_000 });
});

test('salvo com título longo ocupa uma linha só', async ({ page }) => {
	const title =
		'When the AI Director catches you having fun with an extremely long title that must never wrap';
	const save = await page.request.post('/api/state', {
		data: {
			action: 'save',
			id: 'e2e-post-longo',
			snapshot: {
				item: {
					id: 'e2e-post-longo',
					sourceId: 'e2e-fonte',
					title,
					summary: 'Título longo para conferir o corte em uma linha.',
					url: 'https://example.com/post-e2e-longo',
					publishedAt: '2026-01-01T00:00:00.000Z',
					thumbnail: null
				},
				sourceId: 'e2e-fonte',
				sourceName: 'Fonte E2E',
				savedAt: '2026-01-02T00:00:00.000Z'
			}
		}
	});
	expect(save.ok()).toBe(true);

	await page.goto('/');
	const row = page.locator('.home-aside .source-row', { hasText: 'When the AI Director' });
	await expect(row).toHaveCount(1);

	const rowBox = await row.boundingBox();
	const titleBox = await row.locator('.row-title').boundingBox();
	const dateBox = await row.locator('.count').boundingBox();

	expect(rowBox!.height).toBeLessThan(30);
	expect(titleBox!.y).toBeGreaterThanOrEqual(rowBox!.y);
	expect(Math.abs(titleBox!.y - dateBox!.y)).toBeLessThan(12);

	await page.request.post('/api/state', {
		data: { action: 'unsave', id: 'e2e-post-longo' }
	});
});
