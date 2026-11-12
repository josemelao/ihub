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
