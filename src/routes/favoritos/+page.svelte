<script lang="ts">
	import FeedBoard from '#lib/components/FeedBoard.svelte';
	import QuickAccess from '#lib/components/QuickAccess.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
	import { buildFeedView } from '#lib/feed/view';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const hub = $derived(data.hub);
	const entries = $derived(buildFeedView(hub, data.feed, data.state, { savedOnly: true }));
</script>

<svelte:head>
	<title>Favoritos · Meu Hub</title>
</svelte:head>

<TopBar placeholder="Buscar favoritos" />

<div class="section-head">
	<h1>Favoritos</h1>
	<span class="muted small">Atalhos fixados e filtros salvos</span>
</div>

<QuickAccess {hub} />

<section class="panel section" aria-labelledby="t-filtros">
	<h2 id="t-filtros" style="font-size: 15px">Filtros salvos</h2>
	<div class="chips">
		{#each hub.savedFilters as filter (filter.id)}
			<span class="chip">{filter.label}</span>
		{/each}
		{#if hub.savedFilters.length === 0}
			<span class="muted small">Nenhum filtro salvo.</span>
		{/if}
	</div>
</section>

<div class="placeholder-panel">
	<span class="placeholder-title">Posts salvos</span>
	<span class="muted">
		Use "Salvar para depois" nos cards do feed. Os posts salvos aparecem abaixo.
	</span>
</div>

<FeedBoard {entries} title="Salvos para depois" />
