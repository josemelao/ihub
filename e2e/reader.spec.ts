import { expect, test } from './fixtures';

test('reader mostra artigo cacheado e persiste destaque', async ({ page }) => {
	await page.goto('/ler/e2e-post');
	await expect(page.getByRole('heading', { name: 'Post de teste E2E' })).toBeVisible();

	await page.locator('.reader-body p').first().click({ clickCount: 3 });
	await page.getByRole('button', { name: 'Destacar em amarelo' }).click();

	await expect(page.getByRole('heading', { name: 'Seus destaques' })).toBeVisible();
	await expect(page.locator('.reader-highlights')).toContainText('amarelo');

	await page.reload();
	await expect(page.locator('.reader-highlights')).toContainText('amarelo');
});

test('remover destaque pede confirmação', async ({ page }) => {
	await page.goto('/ler/e2e-post');
	const remove = page.getByRole('button', { name: /Remover destaque/ }).first();
	await remove.click();

	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible();
	await dialog.getByRole('button', { name: 'Cancelar' }).click();
	await expect(page.locator('.reader-highlights')).toHaveCount(1);

	await remove.click();
	await page.getByRole('dialog').getByRole('button', { name: 'Remover' }).click();
	await expect(page.locator('.reader-highlights')).toHaveCount(0);
});

test('reader mostra fallback quando a extração falha', async ({ page }) => {
	await page.goto('/ler/e2e-post-erro');

	await expect(page.getByRole('link', { name: 'Abrir original' })).toBeVisible();
	await expect(page.getByRole('status').first()).toBeVisible();
	await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
});

test('reader cacheado abre sem nenhuma requisição externa', async ({ page }) => {
	const external: string[] = [];
	page.on('request', (request) => {
		const url = new URL(request.url());
		if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') external.push(request.url());
	});

	await page.goto('/ler/e2e-post');
	await expect(page.getByRole('heading', { name: 'Post de teste E2E' })).toBeVisible();
	expect(external).toEqual([]);
});

test('reader sem texto completo oferece ativar', async ({ page }) => {
	await page.goto('/ler/e2e-post-off');

	await expect(page.getByRole('button', { name: /Ativar texto completo/ })).toBeVisible();
});

test('tela de destaques lista e busca', async ({ page }) => {
	await page.goto('/highlights');
	await expect(page.getByRole('heading', { name: 'Destaques' })).toBeVisible();

	await page.getByRole('searchbox').fill('texto que não existe');
	await expect(page.getByText(/Nenhum destaque/i)).toBeVisible();
});

test('tela de destaques permite remover com confirmação', async ({ page }) => {
	await page.request.post('/api/highlights', {
		data: { action: 'save', itemId: 'e2e-post', quote: 'trecho para remover', color: 'blue' }
	});
	await page.goto('/highlights');

	const remove = page.getByRole('button', { name: /Remover destaque/ }).first();
	await remove.click();
	await expect(page.getByRole('dialog')).toBeVisible();
	await page.getByRole('dialog').getByRole('button', { name: 'Remover' }).click();

	await expect(page.getByText(/Nenhum destaque/i)).toBeVisible();
});

test('tela de destaques filtra por cor', async ({ page }) => {
	const ids: string[] = [];
	for (const [quote, color] of [
		['trecho amarelo', 'yellow'],
		['trecho azul', 'blue']
	] as const) {
		const response = await page.request.post('/api/highlights', {
			data: { action: 'save', itemId: 'e2e-post', quote, color }
		});
		const body = (await response.json()) as {
			highlights: { highlights: { id: string; quote: string }[] };
		};
		ids.push(body.highlights.highlights.find((highlight) => highlight.quote === quote)!.id);
	}

	try {
		await page.goto('/highlights');
		await page.getByRole('button', { name: /^azul/ }).click();

		await expect(page.getByRole('button', { name: /^azul/ })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(page.getByText('trecho azul')).toBeVisible();
		await expect(page.getByText('trecho amarelo')).toHaveCount(0);
	} finally {
		for (const id of ids) {
			await page.request.post('/api/highlights', { data: { action: 'delete', id } });
		}
	}
});
