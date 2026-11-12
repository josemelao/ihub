import { expect, test } from './fixtures';

test('abre o arquivo local sem nenhuma requisição externa', async ({ page }) => {
	const external: string[] = [];
	page.on('request', (request) => {
		const url = new URL(request.url());
		if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') external.push(request.url());
	});

	await page.goto('/arquivo/e2e-post');

	await expect(page.getByText('Post de teste E2E').first()).toBeVisible();
	await expect(page.locator('.archive-body img')).toBeVisible();
	expect(external).toEqual([]);
});

test('reader oferece a versão arquivada', async ({ page }) => {
	await page.goto('/ler/e2e-post');

	await expect(page.getByRole('link', { name: 'Abrir versão arquivada' })).toBeVisible();
});

test('Gerenciar lista o arquivo e o espaço usado', async ({ page }) => {
	await page.goto('/gerenciar?tab=backups');

	await expect(page.getByRole('heading', { name: 'Leitura arquivada' })).toBeVisible();
	await expect(page.getByText(/Cópias locais das páginas salvas/i)).toBeVisible();
});
