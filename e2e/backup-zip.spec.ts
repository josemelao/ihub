import { readFile } from 'node:fs/promises';
import { strFromU8, unzipSync } from 'fflate';
import { expect, test } from './fixtures';
import type { Download } from '@playwright/test';

async function downloadZip(download: Download): Promise<Record<string, Uint8Array>> {
	const path = await download.path();
	expect(path).not.toBeNull();
	return unzipSync(new Uint8Array(await readFile(path!)));
}

test('baixa o backup completo em ZIP com os dados e o texto dos artigos', async ({ page }) => {
	await page.goto('/gerenciar?tab=backups');

	const pending = page.waitForEvent('download');
	await page.getByRole('link', { name: /Baixar backup completo/i }).click();
	const files = await downloadZip(await pending);

	expect(Object.keys(files)).toEqual(
		expect.arrayContaining(['manifest.json', 'hub.json', 'estado.json', 'reading/e2e-post.json'])
	);
	expect(Object.keys(files).some((name) => name.startsWith('archive/'))).toBe(false);

	const manifest = JSON.parse(strFromU8(files['manifest.json'])) as {
		app: string;
		includesArchive: boolean;
	};
	expect(manifest.app).toBe('meu-hub');
	expect(manifest.includesArchive).toBe(false);
});

test('inclui as páginas arquivadas quando a opção é marcada', async ({ page }) => {
	await page.goto('/gerenciar?tab=backups');
	await page.getByLabel(/Incluir páginas arquivadas/i).check();

	const pending = page.waitForEvent('download');
	await page.getByRole('link', { name: /Baixar backup completo/i }).click();
	const files = await downloadZip(await pending);

	expect(Object.keys(files)).toEqual(
		expect.arrayContaining(['archive/e2e-post/index.html', 'archive.json'])
	);
	const manifest = JSON.parse(strFromU8(files['manifest.json'])) as { includesArchive: boolean };
	expect(manifest.includesArchive).toBe(true);
});
