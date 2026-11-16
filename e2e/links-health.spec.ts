import { expect, test } from './fixtures';

type LinkItem = { id: string; name: string; type: string; url: string; categoryId: string };

async function firstLink(page: import('@playwright/test').Page): Promise<LinkItem> {
	const response = await page.request.get('/api/hub');
	const hub = (await response.json()) as { items: LinkItem[] };
	const link = hub.items.find((item) => item.type === 'link');
	expect(link).toBeTruthy();
	return link!;
}

test('mostra links quebrados e atualiza ao verificar', async ({ page }) => {
	const link = await firstLink(page);
	const checkedAt = '2026-01-02T00:00:00.000Z';

	await page.route('**/api/links/health', async (route) => {
		if (route.request().method() === 'POST') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					ok: true,
					version: 1,
					checkedAt: '2026-01-03T00:00:00.000Z',
					entries: { [link.id]: { status: 'ok', checkedAt: '2026-01-03T00:00:00.000Z' } }
				})
			});
			return;
		}
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				version: 1,
				checkedAt,
				entries: {
					[link.id]: { status: 'broken', code: 404, message: 'HTTP 404', checkedAt }
				}
			})
		});
	});

	await page.goto('/gerenciar?tab=itens');

	await expect(page.getByText('1 quebrado', { exact: true })).toBeVisible();
	await expect(
		page.locator('.manage-row', { hasText: link.name }).getByText('quebrado', { exact: true })
	).toBeVisible();

	await page.getByRole('button', { name: 'Verificar links' }).click();
	await expect(page.getByText('1 link verificado.')).toBeVisible();
	await expect(page.getByText('1 quebrado', { exact: true })).toHaveCount(0);
	await expect(
		page.locator('.manage-row', { hasText: link.name }).getByText('quebrado', { exact: true })
	).toHaveCount(0);
});

test('agrupa links duplicados e permite remover a cópia', async ({ page }) => {
	const link = await firstLink(page);
	const name = `Duplicado E2E ${Date.now()}`;
	const duplicateUrl = new URL(link.url);
	duplicateUrl.searchParams.set('utm_source', 'e2e');

	const added = await page.request.post('/api/hub', {
		data: {
			action: 'add-item',
			item: { type: 'link', name, url: duplicateUrl.toString(), categoryId: link.categoryId }
		}
	});
	expect(added.ok()).toBe(true);

	try {
		await page.goto('/gerenciar?tab=itens');

		const panel = page.locator('.link-duplicates');
		await expect(panel).toBeVisible();
		await expect(panel).toContainText(name);

		const row = panel.locator('li', { hasText: name });
		await row.getByRole('button', { name: 'Remover' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Remover', exact: true }).click();
		await expect(page.getByText('Alteração salva.')).toBeVisible();

		const after = (await (await page.request.get('/api/hub')).json()) as { items: LinkItem[] };
		expect(after.items.some((item) => item.name === name)).toBe(false);

		await expect(panel).toHaveCount(0);
	} finally {
		const response = await page.request.get('/api/hub');
		const hub = (await response.json()) as { items: LinkItem[] };
		const remaining = hub.items.find((item) => item.name === name);
		if (remaining) {
			await page.request.post('/api/hub', { data: { action: 'delete-item', id: remaining.id } });
		}
	}
});
