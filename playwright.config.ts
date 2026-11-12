import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 5760);

export default defineConfig({
	testDir: './e2e',
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	reporter: [['list'], ['html', { open: 'never' }]],
	timeout: 30_000,
	use: {
		baseURL: `http://127.0.0.1:${PORT}`,
		trace: 'on-first-retry'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		// Semeia o banco de teste antes de subir o build.
		command: 'node e2e/seed.mjs && node scripts/start.mjs',
		url: `http://127.0.0.1:${PORT}/`,
		// Nunca reusa servidor: um `npm start` na mesma porta usaria data/ real.
		reuseExistingServer: false,
		timeout: 120_000,
		env: {
			HOST: '127.0.0.1',
			PORT: String(PORT),
			HUB_DATA_DIR: '.e2e-data',
			NODE_ENV: 'production'
		}
	}
});
