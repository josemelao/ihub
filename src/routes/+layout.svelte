<script lang="ts">
	import '../app.css';
	import CommandPalette from '#lib/components/CommandPalette.svelte';
	import Sidebar from '#lib/components/Sidebar.svelte';
	import { ui } from '#lib/ui.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	function onKeydown(event: KeyboardEvent): void {
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			ui.openPalette();
		} else if (event.key === 'Escape' && ui.paletteOpen) {
			ui.closePalette();
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<svelte:head>
	<title>Meu Hub</title>
	<meta name="theme-color" content="#0F1115" />
</svelte:head>

<a class="skip-link" href="#conteudo">Pular para o conteúdo</a>

<div class="app-shell" style="--accent: {data.hub.settings.accent}">
	<Sidebar hub={data.hub} />

	<main class="main" id="conteudo">
		{#if data.dataError}
			<div class="alert" role="alert">
				<strong>{data.dataError.message}</strong>
				{#if data.dataError.usingBackup}
					<div>Exibindo o último backup válido (<code>hub.json.bak</code>).</div>
				{:else}
					<div>Nenhum backup válido encontrado; exibindo um hub vazio.</div>
				{/if}
				<ul>
					{#each data.dataError.issues.slice(0, 5) as issue, index (index)}
						<li>
							<code>{issue.path.length ? issue.path.join(' › ') : 'arquivo'}</code>: {issue.message}
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		{@render children()}
	</main>
</div>

{#if ui.paletteOpen}
	<CommandPalette hub={data.hub} onclose={() => ui.closePalette()} />
{/if}
