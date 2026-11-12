import { expect, test } from '@playwright/test';

test('adiciona um link pela Biblioteca e ele aparece na lista', async ({ page }) => {
	const name = `E2E Link ${Date.now()}`;

	await page.goto('/biblioteca');
	await page.getByRole('link', { name: 'Adicionar item' }).click();
	await expect(page).toHaveURL(/tab=itens&add=link/);

	const editor = page.getByRole('dialog');
	await editor.locator('#e-name').fill(name);
	await editor.locator('#e-url').fill('https://example.com/e2e');
	await editor.getByRole('button', { name: 'Adicionar', exact: true }).click();

	await expect(editor).toBeHidden({ timeout: 10_000 });
	await page.goto('/biblioteca');
	await expect(page.getByText(name, { exact: true })).toBeVisible();
});
