import { expect, test } from '@playwright/test';

test('a nota rápida sobrevive ao reload e entra na palette', async ({ page }) => {
	const text = `nota e2e ${Date.now()}`;

	await page.goto('/');
	const note = page.locator('#nota');
	await note.fill(text);
	await expect(page.getByText(/Salvo no hub/)).toBeVisible({ timeout: 10_000 });

	await page.reload();
	await expect(page.locator('#nota')).toHaveValue(text);

	await page.keyboard.press('Control+k');
	await page.getByRole('combobox').fill(text);
	await expect(page.getByRole('option', { name: new RegExp(text) })).toBeVisible();
});
