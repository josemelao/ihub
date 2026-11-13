import { expect, test } from './fixtures';

test('ferramentas não repetem a navegação e incluem manutenção', async ({ page }) => {
	await page.goto('/');

	const card = page.getByRole('region', { name: 'Ferramentas' });
	await expect(card.getByRole('button', { name: 'Atualizar agora' })).toBeVisible();
	await expect(card.getByRole('button', { name: 'Backup agora' })).toBeVisible();
	await expect(card.getByRole('link', { name: 'Exportar dados' })).toBeVisible();
	await expect(card.getByRole('link', { name: 'Exportar Markdown' })).toBeVisible();

	// Já existem na sidebar: não devem ocupar espaço na card.
	await expect(card.getByRole('link', { name: 'Ver feed completo' })).toHaveCount(0);
	await expect(card.getByRole('link', { name: 'Favoritos' })).toHaveCount(0);
	await expect(card.getByRole('link', { name: 'Gerenciar' })).toHaveCount(0);
});

test('layout dividido coloca atalhos ao lado do feed e ferramentas no aside', async ({ page }) => {
	const setLayout = async (homeLayout: 'stacked' | 'split') => {
		const response = await page.request.post('/api/hub', {
			data: { action: 'update-settings', settings: { homeLayout } }
		});
		expect(response.ok()).toBe(true);
	};

	await setLayout('split');
	try {
		await page.goto('/');

		await expect(page.locator('.home-split')).toBeVisible();
		await expect(page.locator('.home-split .quick-grid')).toBeVisible();
		await expect(
			page.locator('.home-split').getByRole('heading', { name: 'Últimas notícias' })
		).toBeVisible();
		await expect(
			page.locator('.home-split').getByRole('region', { name: 'Ferramentas' })
		).toBeVisible();
		await expect(
			page.locator('.home-aside').getByRole('region', { name: 'Ferramentas' })
		).toHaveCount(0);
		await expect(page.locator('.home-top')).toHaveCount(0);
	} finally {
		await setLayout('stacked');
	}
});

test('grupo fixado abre a biblioteca focada no grupo', async ({ page }) => {
	const pin = await page.request.post('/api/hub', {
		data: { action: 'update-group', id: 'darktide', groupPatch: { pinned: true } }
	});
	expect(pin.ok()).toBe(true);

	try {
		await page.goto('/');
		const tile = page.locator('.quick-grid a[href*="/biblioteca?grupo=darktide"]');
		await expect(tile).toBeVisible();

		await tile.click();
		await expect(page).toHaveURL(/\/biblioteca\?grupo=darktide/);

		const group = page.locator('#grupo-darktide');
		await expect(group).toBeVisible();
		await expect(group).toHaveClass(/focused/);
	} finally {
		await page.request.post('/api/hub', {
			data: { action: 'update-group', id: 'darktide', groupPatch: { pinned: false } }
		});
	}
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
