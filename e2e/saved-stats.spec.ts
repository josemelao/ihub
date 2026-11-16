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

async function prepareSavedPost(page: import('@playwright/test').Page): Promise<string> {
	await page.request.post('/api/state', { data: { action: 'save', id: 'e2e-post', snapshot } });
	await page.request.post('/api/state', { data: { action: 'read', id: 'e2e-post' } });

	const response = await page.request.post('/api/highlights', {
		data: { action: 'save', itemId: 'e2e-post', quote: 'primeiro parágrafo', color: 'green' }
	});
	expect(response.ok()).toBe(true);
	const body = (await response.json()) as {
		highlights: { highlights: { id: string; itemId: string; quote: string }[] };
	};
	return body.highlights.highlights.find(
		(highlight) => highlight.itemId === 'e2e-post' && highlight.quote === 'primeiro parágrafo'
	)!.id;
}

async function cleanup(page: import('@playwright/test').Page, highlightId: string): Promise<void> {
	await page.request.post('/api/highlights', { data: { action: 'delete', id: highlightId } });
	await page.request.post('/api/state', { data: { action: 'unread', id: 'e2e-post' } });
	await page.request.post('/api/state', { data: { action: 'unsave', id: 'e2e-post' } });
}

test('mostra as estatísticas dos salvos calculadas localmente', async ({ page }) => {
	const highlightId = await prepareSavedPost(page);
	try {
		// O arquivo de `e2e-post` pode ter sido removido por um save/unsave
		// anterior da suíte; a faixa precisa refletir o índice real.
		const archiveResponse = await page.request.get('/api/archive');
		const archive = (await archiveResponse.json()) as {
			entries: { id: string; status: string }[];
		};
		const archivedCount = archive.entries.filter(
			(entry) => entry.id === 'e2e-post' && entry.status === 'ready'
		).length;

		await page.goto('/favoritos');

		const stats = page.getByRole('region', { name: 'Estatísticas dos salvos' });
		await expect(stats.locator('[data-stat="saved"] .saved-stat-value')).toHaveText('1');
		await expect(stats.locator('[data-stat="read"] .saved-stat-value')).toHaveText('1');
		await expect(stats.locator('[data-stat="archived"] .saved-stat-value')).toHaveText(
			String(archivedCount)
		);
		await expect(stats.locator('[data-stat="highlights"] .saved-stat-value')).toHaveText('1');
		await expect(stats.locator('[data-stat="minutes"] .saved-stat-value')).toHaveText('~1 min');
		await expect(stats).toContainText('de leitura');
	} finally {
		await cleanup(page, highlightId);
	}
});

test('a faixa de estatísticas não estoura em 375 px e passa no axe', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 812 });
	const highlightId = await prepareSavedPost(page);
	try {
		await page.goto('/favoritos');
		await expect(page.getByRole('region', { name: 'Estatísticas dos salvos' })).toBeVisible();

		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow).toBe(0);

		const accessibility = await new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
			.analyze();
		const blocking = accessibility.violations.filter(
			(violation) => violation.impact === 'critical' || violation.impact === 'serious'
		);
		expect(blocking.map((violation) => violation.id)).toEqual([]);
	} finally {
		await cleanup(page, highlightId);
	}
});
