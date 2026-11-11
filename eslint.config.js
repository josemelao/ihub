import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	{ ignores: ['mockups/**', 'PLANEJAMENTO-hub.md'] },
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	{
		// Estes componentes apontam para URLs externas e protocolos de app,
		// então o resolve() de rotas internas não se aplica.
		files: [
			'src/lib/components/ItemRow.svelte',
			'src/lib/components/QuickAccess.svelte',
			'src/lib/components/FeedCard.svelte',
			'src/lib/components/TopBar.svelte',
			'src/lib/components/ImageLightbox.svelte',
			'src/lib/components/RedditPlayerDialog.svelte',
			'src/lib/components/VideoPlayerDialog.svelte',
			'src/lib/components/LibraryCard.svelte',
			'src/lib/components/BookmarkletCard.svelte',
			'src/routes/+page.svelte'
		],
		rules: { 'svelte/no-navigation-without-resolve': 'off' }
	},
	{
		// Estes componentes montam links internos com query string já resolvida
		// (ex.: resolve('/feed') + '?fonte=...'), que a regra não consegue analisar.
		files: [
			'src/lib/components/HomeDashboard.svelte',
			'src/lib/components/Sidebar.svelte',
			'src/routes/biblioteca/+page.svelte',
			'src/routes/feed/+page.svelte'
		],
		rules: { 'svelte/no-navigation-without-resolve': 'off' }
	},
	{
		// Override or add rule settings here, such as:
		// 'svelte/button-has-type': 'error'
		rules: {}
	}
);
