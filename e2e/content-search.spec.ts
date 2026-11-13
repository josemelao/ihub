import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

const snapshot = {
	item: {
		id: 'e2e-post',
		sourceId: 'e2e-fonte',
		title: 'Post de teste E2E',
		summary: 'Resumo do post de teste.',
		url: 'https://example.com/post-e2e',
		publishedAt: '2026-01-01T00:00:00.000Z',
		thumbnail: null
	},
	sourceId: 'e2e-fonte',
	sourceName: 'Fonte E2E',
	savedAt: '2026-01-02T00:00:00.000Z'
};

async function saveHighlight(
	page: import('@playwright/test').Page,
	input: { itemId: string; quote: string; note?: string }
): Promise<string> {
	const response = await page.request.post('/api/highlights', {
		data: { action: 'save', ...input, color: 'green' }
	});
	expect(response.ok()).toBe(true);
	const body = (await response.json()) as {
		highlights: { highlights: { id: string; itemId: string; quote: string }[] };
	};
	return body.highlights.highlights.find(
		(highlight) => highlight.itemId === input.itemId && highlight.quote === input.quote
	)!.id;
}

test('busca no conteúdo do salvo, nos destaques e fora dos salvos', async ({ page }) => {
	const save = await page.request.post('/api/state', {
		data: { action: 'save', id: 'e2e-post', snapshot }
	});
	expect(save.ok()).toBe(true);

	const highlightIds: string[] = [];
	try {
		highlightIds.push(
			await saveHighlight(page, {
				itemId: 'e2e-post',
				quote: 'O segundo parágrafo existe',
				note: 'revisar depois'
			})
		);
		highlightIds.push(
			await saveHighlight(page, {
				itemId: 'e2e-post-off',
				quote: 'frase de outro post',
				note: 'guardar'
			})
		);

		await page.goto('/favoritos');
		await page.getByRole('button', { name: 'Conteúdo', exact: true }).click();

		// A ordenação continua disponível e funcional no modo conteúdo.
		await expect(page.getByRole('button', { name: 'Salvamento' })).toBeVisible();
		await page.getByRole('button', { name: 'Publicação' }).click();
		await expect(page.getByRole('button', { name: 'Publicação' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);

		const search = page.getByLabel('Buscar nos salvos');
		await search.fill('primeiro parágrafo');

		await expect(page.locator('.content-snippet mark').first()).toHaveText(/primeiro/i);
		await expect(page.locator('.content-snippet mark').nth(1)).toHaveText(/parágrafo/i);
		await expect(page.locator('.content-summary')).toContainText('1 resultado');
		await expect(page.locator('.content-summary')).toContainText('1 de 1 salvo com texto');
		await expect(
			page.locator('.content-group').first().getByRole('link', { name: 'Post de teste E2E' })
		).toBeVisible();

		await search.fill('revisar');
		await expect(page.locator('.content-kind', { hasText: 'destaque' })).toBeVisible();
		await expect(page.locator('.content-snippet mark')).toContainText('revisar');

		await search.fill('outro post');
		await expect(page.getByText('Destaques fora dos salvos')).toBeVisible();
		await expect(page.locator('.content-meta', { hasText: 'não salvo' })).toBeVisible();

		const accessibility = await new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
			.analyze();
		const blocking = accessibility.violations.filter(
			(violation) => violation.impact === 'critical' || violation.impact === 'serious'
		);
		expect(blocking.map((violation) => violation.id)).toEqual([]);
	} finally {
		for (const id of highlightIds) {
			await page.request.post('/api/highlights', { data: { action: 'delete', id } });
		}
		await page.request.post('/api/state', { data: { action: 'unsave', id: 'e2e-post' } });
	}
});

test('busca no conteúdo não estoura a tela em 375 px', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await page.request.post('/api/state', { data: { action: 'save', id: 'e2e-post', snapshot } });
	try {
		await page.goto('/favoritos');
		await page.getByRole('button', { name: 'Conteúdo', exact: true }).click();
		await page.getByLabel('Buscar nos salvos').fill('parágrafo');
		await expect(page.locator('.content-snippet mark').first()).toBeVisible();

		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow).toBe(0);
	} finally {
		await page.request.post('/api/state', { data: { action: 'unsave', id: 'e2e-post' } });
	}
});
