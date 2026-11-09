<script lang="ts">
	import { resolve } from '$app/paths';
	import { onDestroy, onMount } from 'svelte';
	import FeedBoard from '#lib/components/FeedBoard.svelte';
	import QuickAccess from '#lib/components/QuickAccess.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
	import { buildFeedView } from '#lib/feed/view';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const hub = $derived(data.hub);
	const colors = $derived(Object.fromEntries(hub.categories.map((cat) => [cat.id, cat.color])));
	const sources = $derived(hub.feedSources.filter((source) => source.enabled));
	const entries = $derived(buildFeedView(hub, data.feed, data.state));

	let note = $state('');
	let panelOpen = $state(true);
	let panelAnimating = $state(false);
	let uiReady = $state(false);
	let panelTimer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		note = localStorage.getItem('meu-hub:nota') ?? '';
		panelOpen = localStorage.getItem('meu-hub:panel-open') !== '0';
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				uiReady = true;
			});
		});
	});

	onDestroy(() => {
		clearTimeout(panelTimer);
	});

	function saveNote() {
		localStorage.setItem('meu-hub:nota', note);
	}

	function togglePanel(): void {
		panelOpen = !panelOpen;
		localStorage.setItem('meu-hub:panel-open', panelOpen ? '1' : '0');
		panelAnimating = true;
		clearTimeout(panelTimer);
		panelTimer = setTimeout(() => {
			panelAnimating = false;
		}, 320);
	}

	function unreadFor(sourceId: string): number {
		return data.feed.items.filter((item) => item.sourceId === sourceId && !data.state.read[item.id])
			.length;
	}
</script>

<svelte:head>
	<title>Início · Meu Hub</title>
</svelte:head>

<h1 class="sr-only">Início</h1>

<TopBar />

<QuickAccess {hub} />

<div
	class="home-columns"
	class:panel-closed={!panelOpen}
	class:ui-ready={uiReady}
	class:panel-animating={panelAnimating}
>
	<div class="home-main">
		<div class="home-columns-toolbar">
			<button class="chip" type="button" aria-pressed={panelOpen} onclick={togglePanel}>
				{panelOpen ? 'Recolher painel' : 'Mostrar painel'}
			</button>
		</div>
		<FeedBoard
			{entries}
			savedFilters={hub.savedFilters}
			categories={hub.categories}
			title="Seu feed"
			showCategoryChips
		/>
	</div>

	<aside class="home-aside" aria-label="Painel lateral" aria-hidden={!panelOpen} inert={!panelOpen}>
		<section class="panel section" aria-labelledby="t-fontes">
			<h2 id="t-fontes" style="font-size: 15px">Fontes do feed</h2>
			{#each sources as source (source.id)}
				<div class="source-row">
					<span
						class="dot"
						style="background: {colors[source.categoryId] ?? '#8AA4FF'}; border-radius: 50%"
					></span>
					<span class="soft">{source.name}</span>
					<span class="count" title="Posts não lidos">{unreadFor(source.id)}</span>
				</div>
			{/each}
			{#if sources.length === 0}
				<p class="muted small">Nenhuma fonte ativa no hub.json.</p>
			{/if}
			<a class="chip link" href={resolve('/gerenciar')}>Ver fontes</a>
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
