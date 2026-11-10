<script lang="ts">
	import FeedBoard from '#lib/components/FeedBoard.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
	import { buildSavedView } from '#lib/feed/view';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const hub = $derived(data.hub);
	const entries = $derived(buildSavedView(hub, data.feed, data.state));
</script>

<svelte:head>
	<title>Favoritos · Meu Hub</title>
</svelte:head>

<TopBar placeholder="Buscar favoritos" />

<div class="section-head">
	<h1>Favoritos</h1>
	<span class="muted small">
		{entries.length}
		{entries.length === 1 ? 'post salvo' : 'posts salvos'} para ler depois
	</span>
</div>

<FeedBoard
	{entries}
	title="Posts salvos"
	saved
	emptyTitle="Nenhum post salvo ainda"
	emptyHint="Use 'Salvar para depois' nos cards do feed para guardar posts aqui."
/>
