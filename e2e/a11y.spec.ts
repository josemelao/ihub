import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pages = ['/', '/feed', '/biblioteca', '/gerenciar'];

for (const path of pages) {
	test(`sem violações críticas de acessibilidade em ${path}`, async ({ page }) => {
		await page.goto(path);
		await page.waitForLoadState('networkidle');

		const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();

		const critical = results.violations.filter((violation) => violation.impact === 'critical');

		expect(
			critical.map((violation) => ({
				id: violation.id,
				nodes: violation.nodes.map((node) => node.target.join(' '))
			}))
		).toEqual([]);
	});
}
