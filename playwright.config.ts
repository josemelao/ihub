import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 5760);

export default defineConfig({
	testDir: './e2e',
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
	timeout: 30_000,
	use: {
		baseURL: `http://127.0.0.1:${PORT}`,
		trace: 'on-first-retry',
		// axe injeta script inline; a CSP do app bloquearia sem bypass.
		bypassCSP: true
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	globalSetup: './e2e/global-setup.ts',
	webServer: {
		command: 'node scripts/start.mjs',
		url: `http://127.0.0.1:${PORT}/`,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		env: {
			HOST: '127.0.0.1',
			PORT: String(PORT),
			HUB_DATA_DIR: '.e2e-data',
			NODE_ENV: 'production'
		}
	}
});
