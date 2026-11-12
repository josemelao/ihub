import { expect, test as base } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * E2E hermético: só fala com o servidor local. Ícones externos e qualquer
 * requisição de terceiros são abortados, então o resultado não depende de rede.
 */
export const test = base.extend({
	page: async ({ page }, use) => {
		await page.route('**/*', (route) => {
			const url = new URL(route.request().url());
			if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
				return route.continue();
			}
			return route.abort();
		});
		await use(page);
	}
});

export { expect };

/** Abre a palette esperando a hidratação (repete o atalho até o dialog existir). */
export async function openPalette(page: Page): Promise<void> {
	await expect(async () => {
		await page.keyboard.press('Control+k');
		await expect(page.getByRole('combobox')).toBeVisible({ timeout: 500 });
	}).toPass({ timeout: 10_000 });
}
