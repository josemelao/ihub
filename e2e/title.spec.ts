import { expect, test } from './fixtures';

test('o título da aba reflete os não lidos', async ({ page }) => {
	await page.goto('/feed');
	await expect(page).toHaveTitle('(1) Meu Hub');

	const response = await page.request.post('/api/state', {
		data: { action: 'mark-all-read', ids: ['e2e-post'] }
	});
	expect(response.ok()).toBe(true);

	await page.reload();
	await expect(page).toHaveTitle('Meu Hub');
});
