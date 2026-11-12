import { expect, test } from './fixtures';

test('ações rápidas não repetem a navegação e incluem manutenção', async ({ page }) => {
	await page.goto('/');

	const card = page.getByRole('region', { name: 'Ações rápidas' });
	await expect(card.getByRole('button', { name: 'Atualizar agora' })).toBeVisible();
	await expect(card.getByRole('button', { name: 'Backup agora' })).toBeVisible();
	await expect(card.getByRole('link', { name: 'Exportar dados' })).toBeVisible();
	await expect(card.getByRole('link', { name: 'Exportar Markdown' })).toBeVisible();

	// Já existem na sidebar: não devem ocupar espaço na card.
	await expect(card.getByRole('link', { name: 'Ver feed completo' })).toHaveCount(0);
	await expect(card.getByRole('link', { name: 'Favoritos' })).toHaveCount(0);
	await expect(card.getByRole('link', { name: 'Gerenciar' })).toHaveCount(0);
});

test('backup agora cria um ponto de restauração', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Backup agora' }).click();
	await expect(page.getByText('Backup criado.')).toBeVisible({ timeout: 10_000 });
});
