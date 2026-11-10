<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import FeedBoard from '#lib/components/FeedBoard.svelte';
	import HomeDashboard from '#lib/components/HomeDashboard.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
	import { relativeTime } from '#lib/display';
	import { matchesFilter } from '#lib/feed/filter';
	import { buildFeedView, buildSavedView } from '#lib/feed/view';
	import type { SavedFilter } from '#lib/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const hub = $derived(data.hub);
	const colors = $derived(Object.fromEntries(hub.categories.map((cat) => [cat.id, cat.color])));
	const sources = $derived(hub.feedSources.filter((source) => source.enabled));
	const entries = $derived(buildFeedView(hub, data.feed, data.state));
	const savedRecent = $derived(buildSavedView(hub, data.feed, data.state).slice(0, 3));

	let note = $state('');

	onMount(() => {
		note = localStorage.getItem('meu-hub:nota') ?? '';
	});

	function saveNote() {
		localStorage.setItem('meu-hub:nota', note);
	}

	function unreadFor(sourceId: string): number {
		return data.feed.items.filter((item) => item.sourceId === sourceId && !data.state.read[item.id])
			.length;
	}

	function countForFilter(filter: SavedFilter): number {
		return entries.filter((entry) =>
			matchesFilter(
				`${entry.item.title}\n${entry.item.summary}`,
				filter.include,
				filter.exclude,
				filter.matchMode
			)
		).length;
	}
</script>

<svelte:head>
	<title>Início · Meu Hub</title>
</svelte:head>

<h1 class="sr-only">Início</h1>

<TopBar />

<div class="home-columns">
	<div class="home-main">
		<HomeDashboard hub={data.hub} feed={data.feed} hubState={data.state} />
		<FeedBoard {entries} title="Últimas notícias" overview />
	</div>

	<aside class="home-aside" aria-label="Painel lateral">
		<section class="panel section" aria-labelledby="t-fontes">
			<h2 id="t-fontes" style="font-size: 15px">Fontes do feed</h2>
			{#each sources as source (source.id)}
				<a class="source-row" href={`${resolve('/feed')}?fonte=${source.id}`}>
					<span
						class="dot"
						style="background: {colors[source.categoryId] ?? '#8AA4FF'}; border-radius: 50%"
					></span>
					<span class="soft">{source.name}</span>
					<span class="count" title="Posts não lidos">{unreadFor(source.id)}</span>
				</a>
			{/each}
			{#if sources.length === 0}
				<p class="muted small">Nenhuma fonte ativa no hub.json.</p>
			{/if}
			<a class="chip link" href={resolve('/gerenciar')}>Ver fontes</a>
		</section>

		<section class="panel section" aria-labelledby="t-filtros">
			<div class="section-head">
				<h2 id="t-filtros" style="font-size: 15px">Filtros salvos</h2>
				<a class="muted small" href={resolve('/feed')}>Ver feed</a>
			</div>
			<div class="chips">
				{#each hub.savedFilters as filter (filter.id)}
					<a class="chip" href={resolve('/feed') + '?filtro=' + filter.id}>
						{filter.label} · {countForFilter(filter)}
					</a>
				{/each}
				{#if hub.savedFilters.length === 0}
					<span class="muted small">Nenhum filtro salvo.</span>
				{/if}
			</div>
		</section>

		<section class="panel section" aria-labelledby="t-salvos">
			<div class="section-head">
				<h2 id="t-salvos" style="font-size: 15px">Salvos recentemente</h2>
				<a class="muted small" href={resolve('/favoritos')}>Ver todos</a>
			</div>
			{#each savedRecent as entry (entry.item.id)}
				<a
					class="source-row"
					href={entry.item.url}
					target="_blank"
					rel="noopener noreferrer"
					title={entry.item.title}
				>
					<span
						class="dot"
						style="background: {entry.category?.color ?? '#8AA4FF'}; border-radius: 50%"
					></span>
					<span class="soft" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
						{entry.item.title}
					</span>
					<span class="count">{relativeTime(entry.item.publishedAt)}</span>
				</a>
			{/each}
			{#if savedRecent.length === 0}
				<span class="muted small">Nenhum post salvo ainda.</span>
			{/if}
		</section>

		<section class="panel section" aria-labelledby="t-nota">
			<h2 id="t-nota" style="font-size: 15px">Nota rápida</h2>
			<label class="sr-only" for="nota">Nota rápida</label>
			<textarea
				id="nota"
				class="note-area"
				rows="4"
				placeholder="Anote algo e siga o dia..."
				bind:value={note}
				oninput={saveNote}></textarea>
			<span class="muted small">Salva neste navegador.</span>
		</section>
	</aside>
</div>
