import { expect, test } from './fixtures';

test.use({ viewport: { width: 375, height: 720 } });

test('mobile 375 px carrega a home sem overflow horizontal', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('main')).toBeVisible();

	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);

	expect(overflow).toBeLessThanOrEqual(1);
});

test('menu mobile abre em drawer, navega e fecha', async ({ page }) => {
	await page.goto('/');

	const toggle = page.getByRole('button', { name: 'Abrir menu de navegação' });
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await toggle.click();
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');

	const nav = page.getByRole('navigation', { name: 'Menu principal' });
	await expect(nav).toHaveClass(/open/);

	await nav.getByRole('link', { name: /Biblioteca/i }).click();
	await expect(page).toHaveURL(/\/biblioteca/);
	await expect(nav).not.toHaveClass(/open/);

	await toggle.click();
	await expect(nav).toHaveClass(/open/);
	await page.keyboard.press('Escape');
	await expect(nav).not.toHaveClass(/open/);
});

test('preferências de leitura persistem no hub', async ({ page }) => {
	await page.goto('/gerenciar?tab=aparencia');

	await page.locator('#e-density').selectOption('compact');
	await page.locator('#e-font-size').selectOption('15');
	await page.getByLabel('Contraste alto').check();
	await page.getByRole('button', { name: 'Salvar aparência' }).click();

	await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');

	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
	await expect(page.locator('html')).toHaveAttribute('data-font', '15');
	await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');
});
