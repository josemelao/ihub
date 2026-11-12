import { expect, test } from './fixtures';

test('salva um post e ele aparece em Salvos', async ({ page }) => {
	await page.goto('/feed');
	await expect(page.getByText('Post de teste E2E').first()).toBeVisible();

	// Retry-safe: se uma tentativa anterior já salvou, volta ao estado inicial.
	const saved = page.getByRole('button', { name: 'Remover dos salvos' });
	if (await saved.count()) {
		await saved.first().click();
		await expect(page.getByRole('button', { name: 'Salvar para depois' }).first()).toBeVisible();
	}

	await page.getByRole('button', { name: 'Salvar para depois' }).first().click();
	await expect(saved.first()).toBeVisible({ timeout: 10_000 });

	await page.goto('/favoritos');
	await expect(page.getByText('Post de teste E2E').first()).toBeVisible({ timeout: 10_000 });
});

test('marca tudo como lido com confirmação e desfaz', async ({ page }) => {
	await page.goto('/feed');
	await page.getByRole('button', { name: 'Marcar tudo como lido' }).click();
	await page
		.getByRole('dialog')
		.getByRole('button', { name: 'Marcar como lido', exact: true })
		.click();

	await expect(page.getByText(/posts? marcados? como lidos/i)).toBeVisible({ timeout: 10_000 });

	await page.getByRole('status').getByRole('button', { name: 'Desfazer' }).click();
	await expect(page.getByRole('button', { name: 'Marcar tudo como lido' })).toBeVisible();
});
