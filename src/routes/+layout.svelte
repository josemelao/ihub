<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
	import Sidebar from '#lib/components/Sidebar.svelte';
	import CommandPalette from '#lib/components/CommandPalette.svelte';
	import QuickAddDialog from '#lib/components/QuickAddDialog.svelte';
	import { contrastText } from '#lib/display';
	import { countUnread } from '#lib/feed/triage';
	import { buildFeedView } from '#lib/feed/view';
	import { ui } from '#lib/ui.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const feedEntries = $derived(buildFeedView(data.hub, data.feed, data.state));
	const unread = $derived(feedEntries.filter((entry) => !entry.read).length);
	const unreadByCategory = $derived(countUnread(feedEntries).byCategory);

	onMount(() => {
		if (import.meta.env.PROD && 'serviceWorker' in navigator) {
			navigator.serviceWorker.register('/service-worker.js').catch(() => undefined);
		}
	});

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

<div
	class="app-shell"
	style="--accent: {data.hub.settings.accent}; --on-accent: {contrastText(
		data.hub.settings.accent
	)}"
>
	<Sidebar hub={data.hub} {unread} {unreadByCategory} savedCount={data.state.saved.length} />

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

		{#if data.stateError || data.cacheError || data.notesError}
			<div class="alert" role="alert">
				<strong>Dados auxiliares inválidos</strong>
				{#if data.stateError}
					<div>
						estado.json: {data.stateError.message}
						{data.stateError.usingBackup ? 'Usando o backup.' : 'Usando estado vazio.'}
					</div>
				{/if}
				{#if data.cacheError}
					<div>
						feed-cache.json: {data.cacheError.message}
						{data.cacheError.usingBackup ? 'Usando o backup.' : 'Usando cache vazio.'}
					</div>
				{/if}
				{#if data.notesError}
					<div>
						notes.json: {data.notesError.message}
						{data.notesError.usingBackup ? 'Usando o backup.' : 'Usando notas vazias.'}
					</div>
				{/if}
			</div>
		{/if}

		{#if data.stateRecovery}
			<div class="alert" role="status">
				<strong>estado.json recuperado</strong>
				<div>
					{#if data.stateRecovery.removedSnapshots > 0}
						{data.stateRecovery.removedSnapshots} snapshot(s) inválido(s),{/if}
					{#if data.stateRecovery.removedRead > 0}
						{data.stateRecovery.removedRead} leitura(s) inválida(s),{/if}
					{#if data.stateRecovery.removedSaved > 0}
						{data.stateRecovery.removedSaved} id(s) salvo(s) inválido(s),{/if}
					foram descartados; o restante foi mantido.
				</div>
			</div>
		{/if}

		{@render children()}
	</main>
</div>

{#if ui.paletteOpen}
	<CommandPalette
		hub={data.hub}
		feed={data.feed}
		hubState={data.state}
		notes={data.notes}
		onclose={() => ui.closePalette()}
	/>
{/if}

{#if ui.quickAddOpen}
	<QuickAddDialog onclose={() => ui.closeQuickAdd()} />
{/if}
