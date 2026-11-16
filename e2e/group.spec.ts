import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

type HubItem = { id: string; name: string; type: string; url?: string; groupId?: string };

async function darktideData(page: import('@playwright/test').Page): Promise<{
	items: HubItem[];
	links: HubItem[];
}> {
	const hub = (await (await page.request.get('/api/hub')).json()) as {
		items: HubItem[];
	};
	const items: HubItem[] = hub.items.filter((item) => item.groupId === 'darktide');
	return { items, links: items.filter((item) => item.type === 'link') };
}

test('página do grupo mostra itens, cabeçalho e estado do feed', async ({ page }) => {
	const { items } = await darktideData(page);

	await page.goto('/g/darktide');

	await expect(page.getByRole('heading', { name: 'Darktide', level: 1 })).toBeVisible();
	await expect(page.locator('.cat-identity')).toContainText('Jogos');
	await expect(page.locator('.cat-identity')).toContainText(`${items.length} itens`);
	for (const item of items) {
		await expect(page.locator('.library-grid')).toContainText(item.name);
	}
	await expect(page.getByText('Nenhuma fonte vinculada a este grupo.')).toBeVisible();

	const accessibility = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
		.analyze();
	const blocking = accessibility.violations.filter(
		(violation) => violation.impact === 'critical' || violation.impact === 'serious'
	);
	expect(blocking.map((violation) => violation.id)).toEqual([]);
});

test('abrir tudo pede confirmação e abre os links em novas abas', async ({ page, context }) => {
	const { links } = await darktideData(page);
	expect(links.length).toBeGreaterThan(0);

	await page.goto('/g/darktide');
	await page.getByRole('button', { name: 'Abrir tudo' }).click();

	const dialog = page.getByRole('dialog');
	await expect(dialog).toContainText(`${links.length} links`);

	const popupPromise = page.waitForEvent('popup');
	await dialog.getByRole('button', { name: 'Abrir tudo' }).click();
	const popup = await popupPromise;

	expect(links.map((item) => item.url)).toContain(popup.url());
	await expect(page.getByRole('status')).toContainText(/aberto|bloquead/i);

	await popup.close();
	for (const extra of context.pages()) {
		if (extra !== page) await extra.close();
	}
});

test('grupo inexistente mostra 404 amigável', async ({ page }) => {
	await page.goto('/g/nao-existe');

	await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
	await expect(page.getByText(/não encontrado/i)).toBeVisible();
});

test('o card do grupo na categoria leva para a página do grupo', async ({ page }) => {
	await page.goto('/c/jogos');

	const card = page.locator('.group-card', { hasText: 'Darktide' });
	await card.getByRole('link', { name: 'abrir grupo' }).click();

	await expect(page).toHaveURL(/\/g\/darktide$/);
	await expect(page.getByRole('heading', { name: 'Darktide', level: 1 })).toBeVisible();
});
