<script lang="ts">
	import FeedBoard from '#lib/components/FeedBoard.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { relativeTime } from '#lib/display';
	import { sortFeedSources } from '#lib/feed/order';
	import { buildFeedView } from '#lib/feed/view';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const hub = $derived(data.hub);
	const catName = $derived(Object.fromEntries(hub.categories.map((cat) => [cat.id, cat.name])));
	const sources = $derived(sortFeedSources(hub.feedSources));
	const enabledCount = $derived(sources.filter((source) => source.enabled).length);
	const entries = $derived(buildFeedView(hub, data.feed, data.state));
	const initialFilterId = $derived(page.url.searchParams.get('filtro'));
	const initialSourceId = $derived(page.url.searchParams.get('fonte'));
	const initialUnreadOnly = $derived(page.url.searchParams.get('nao-lidos') === '1');
	const updatedLabel = $derived(
		data.feed.items.length > 0
			? `atualizado ${relativeTime(data.feed.updatedAt)}`
			: 'nunca atualizado'
	);
</script>

<svelte:head>
	<title>Feed completo · Meu Hub</title>
</svelte:head>

<TopBar placeholder="Buscar no feed" />

<div class="section-head">
	<h1>Feed completo</h1>
	<span class="muted small">
		{data.feed.items.length} posts no cache · {enabledCount} fontes ativas · {updatedLabel}
	</span>
</div>

<FeedBoard
	{entries}
	title="Todos os posts"
	savedFilters={hub.savedFilters}
	categories={hub.categories}
	{sources}
	showCategoryChips
	{initialFilterId}
	{initialSourceId}
	{initialUnreadOnly}
/>

<section class="panel section" aria-labelledby="t-todas-fontes">
	<h2 id="t-todas-fontes" style="font-size: 15px">Fontes do feed</h2>
	{#each sources as source (source.id)}
		{@const status = data.feed.sources[source.id]}
		<div class="source-row">
			<span
				class="dot"
				style="background: {hub.categories.find((c) => c.id === source.categoryId)?.color ??
					'#8AA4FF'}; border-radius: 50%"
			></span>
			<a class="soft" href={resolve('/feed') + '?fonte=' + source.id}>{source.name}</a>
			<span class="tag">{source.enabled ? 'ativa' : 'desligada'}</span>
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
	{#if sources.length === 0}
		<p class="muted small">Nenhuma fonte cadastrada.</p>
	{/if}
</section>
