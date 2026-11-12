import { expect, test } from '@playwright/test';

test('a palette encontra um link do hub e executa um comando', async ({ page }) => {
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	await page.keyboard.press('Control+k');

	const input = page.getByRole('combobox');
	await expect(input).toBeFocused();

	await input.fill('Wiki da comunidade');
	await expect(page.getByRole('option', { name: /Wiki da comunidade/i }).first()).toBeVisible();

	await input.fill('>adicionar');
	await expect(page.getByRole('option', { name: /Adicionar link/i })).toBeVisible();
});

test('paleta navega para o editor de link ao executar o comando', async ({ page }) => {
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	await page.keyboard.press('Control+k');
	await page.getByRole('combobox').fill('>adicionar');
	await page.getByRole('option', { name: /Adicionar link/i }).click();

	await expect(page).toHaveURL(/\/gerenciar\?tab=itens&add=link/);
	await expect(page.getByRole('heading', { name: /Adicionar link/i })).toBeVisible({
		timeout: 10_000
	});
});
