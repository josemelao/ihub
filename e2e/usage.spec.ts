import { expect, test } from './fixtures';

type Item = { id: string; name: string; type: string };

async function items(page: import('@playwright/test').Page): Promise<Item[]> {
	const hub = (await (await page.request.get('/api/hub')).json()) as { items: Item[] };
	return hub.items;
}

async function clearUsage(page: import('@playwright/test').Page): Promise<void> {
	await page.request.delete('/api/usage', { data: {} });
}

test.beforeEach(async ({ page }) => {
	await clearUsage(page);
});

test.afterEach(async ({ page }) => {
	await clearUsage(page);
});

test('abrir um link o coloca em Recentes na home', async ({ page }) => {
	const link = (await items(page)).find((item) => item.type === 'link')!;
	expect(link).toBeTruthy();

	await page.goto('/biblioteca');
	const card = page.locator('.library-card', { hasText: link.name });

	const tracked = page.waitForResponse(
		(response) => response.url().endsWith('/api/usage') && response.request().method() === 'POST'
	);
	const popupPromise = page.waitForEvent('popup');
	await card.click();
	await tracked;
	const popup = await popupPromise;
	await popup.close();

	await page.goto('/');
	await expect(page.locator('section[aria-labelledby="t-recentes"]')).toContainText(link.name);
});

test('mais usados ordena por contagem e limpa o histórico', async ({ page }) => {
	const links = (await items(page)).filter((item) => item.type === 'link').slice(0, 2);
	expect(links).toHaveLength(2);

	for (let index = 0; index < 3; index += 1) {
		await page.request.post('/api/usage', { data: { id: links[0].id } });
	}
	await page.request.post('/api/usage', { data: { id: links[1].id } });

	await page.goto('/biblioteca');
	const mostUsed = page.locator('section[aria-labelledby="t-most-used"]');
	await expect(mostUsed).toBeVisible();
	await expect(mostUsed.locator('.library-card-name').first()).toHaveText(links[0].name);

	await page.getByRole('button', { name: 'Limpar histórico' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Limpar', exact: true }).click();

	await expect(page.getByText('Histórico limpo.')).toBeVisible();
	await expect(mostUsed).toHaveCount(0);
});
