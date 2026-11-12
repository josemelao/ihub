import { expect, test } from './fixtures';

test.use({ viewport: { width: 375, height: 720 } });

test('mobile 375 px carrega a home sem overflow horizontal', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('main')).toBeVisible();

	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);

	expect(overflow).toBeLessThanOrEqual(1);
	await expect(page.getByRole('link', { name: /Biblioteca/i }).first()).toBeVisible();
});
