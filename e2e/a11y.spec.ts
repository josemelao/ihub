import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

const pages = ['/', '/feed', '/biblioteca', '/gerenciar'];

for (const path of pages) {
	test(`sem violações críticas ou sérias de acessibilidade em ${path}`, async ({ page }) => {
		await page.goto(path);

		const results = await new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
			.analyze();

		const blocking = results.violations.filter(
			(violation) => violation.impact === 'critical' || violation.impact === 'serious'
		);

		expect(
			blocking.map((violation) => ({
				id: violation.id,
				impact: violation.impact,
				nodes: violation.nodes.map((node) => node.target.join(' '))
			}))
		).toEqual([]);
	});
}
