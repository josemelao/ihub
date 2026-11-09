<script lang="ts">
	import '../app.css';
	import Sidebar from '#lib/components/Sidebar.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<svelte:head>
	<title>Meu Hub</title>
	<meta name="theme-color" content="#0F1115" />
</svelte:head>

<div class="app-shell" style="--accent: {data.hub.settings.accent}">
	<Sidebar hub={data.hub} />

	<main class="main">
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
