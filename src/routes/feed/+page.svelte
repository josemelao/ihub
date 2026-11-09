<script lang="ts">
	import FeedBoard from '#lib/components/FeedBoard.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
	import { relativeTime } from '#lib/display';
	import { buildFeedView } from '#lib/feed/view';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const hub = $derived(data.hub);
	const catName = $derived(Object.fromEntries(hub.categories.map((cat) => [cat.id, cat.name])));
	const sources = $derived(hub.feedSources);
	const entries = $derived(buildFeedView(hub, data.feed, data.state));
</script>

<svelte:head>
	<title>Feed completo · Meu Hub</title>
</svelte:head>

<TopBar placeholder="Buscar no feed" />

<div class="section-head">
	<h1>Feed completo</h1>
	<span class="muted small">Todos os posts das fontes ativas, em um só lugar</span>
</div>

<FeedBoard
	{entries}
	title="Todos os posts"
	savedFilters={hub.savedFilters}
	categories={hub.categories}
	showCategoryChips
/>

<section class="panel section" aria-labelledby="t-todas-fontes">
	<h2 id="t-todas-fontes" style="font-size: 15px">Fontes cadastradas</h2>
	{#each sources as source (source.id)}
		{@const status = data.feed.sources[source.id]}
		<div class="source-row">
			<span
				class="dot"
				style="background: {hub.categories.find((c) => c.id === source.categoryId)?.color ??
					'#8AA4FF'}; border-radius: 50%"
			></span>
			<span class="soft">{source.name}</span>
			<span class="muted small">{catName[source.categoryId] ?? source.categoryId}</span>
			<span class="count" title={status?.error ?? 'Última atualização'}>
				{status?.error
					? 'falhou'
					: status?.lastFetchedAt
						? relativeTime(status.lastFetchedAt)
						: '—'}
			</span>
		</div>
	{/each}
</section>
