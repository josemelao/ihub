<script lang="ts">
	import FeedBoard from '#lib/components/FeedBoard.svelte';
	import ReadingStatsStrip from '#lib/components/ReadingStatsStrip.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
	import { buildSavedView } from '#lib/feed/view';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const hub = $derived(data.hub);
	const entries = $derived(buildSavedView(hub, data.feed, data.state));
</script>

<svelte:head>
	<title>Salvos · Meu Hub</title>
</svelte:head>

<TopBar placeholder="Buscar salvos" />

<div class="section-head">
	<h1>Salvos</h1>
	<span class="muted small">para ler depois</span>
</div>

<ReadingStatsStrip stats={data.stats} />

<FeedBoard
	{entries}
	title="Posts salvos"
	saved
	emptyTitle="Nenhum post salvo ainda"
	emptyHint="Use 'Salvar para depois' nos cards do feed para guardar posts aqui."
/>
