<script lang="ts">
	import FeedBoard from '#lib/components/FeedBoard.svelte';
	import GroupCard from '#lib/components/GroupCard.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
	import { resolve } from '$app/paths';
	import { buildFeedView } from '#lib/feed/view';
	import type { HubItem } from '#lib/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const category = $derived(data.category);
	const groups = $derived(data.groups);
	const items = $derived(data.items);
	const ungroupedIds = $derived(new Set(data.ungroupedIds));

	let selected = $state('all');

	const visibleGroups = $derived(
		selected === 'all' ? groups : groups.filter((group) => group.id === selected)
	);
	const itemCount = $derived(items.length);
	const sourceCount = $derived(data.sources.length);
	const entries = $derived(
		buildFeedView(data.hub, data.feed, data.state, { categoryId: category.id })
	);

	function itemsFor(groupId: string, isUngrouped: boolean): HubItem[] {
		return items.filter((item) =>
			isUngrouped ? ungroupedIds.has(item.id) : item.groupId === groupId
		);
	}
</script>

<svelte:head>
	<title>{category.name} · Meu Hub</title>
</svelte:head>

<TopBar
	placeholder={`Buscar em ${category.name}`}
	action={`Adicionar em ${category.name}`}
	actionHref={`${resolve('/gerenciar')}?tab=itens&add=link&category=${category.id}`}
/>

<div class="cat-header">
	<div class="cat-identity">
		<div class="cat-title">
			<span class="cat-square" style="background: {category.color}"></span>
			<h1>{category.name}</h1>
		</div>
		<span class="muted">
			{itemCount} itens em {groups.length} grupos · {sourceCount} fontes de feed
		</span>
	</div>

	<div class="chips" role="group" aria-label="Filtrar por grupo">
		<button
			class="chip"
			class:active={selected === 'all'}
			type="button"
			aria-pressed={selected === 'all'}
			onclick={() => (selected = 'all')}
		>
			Todos os grupos
		</button>
		{#each groups as group (group.id)}
			<button
				class="chip"
				class:active={selected === group.id}
				type="button"
				aria-pressed={selected === group.id}
				onclick={() => (selected = group.id)}
			>
				{group.name}
			</button>
		{/each}
	</div>
</div>

<section class="section" aria-labelledby="t-links">
	<h2 id="t-links">Links e apps</h2>
	<div class="group-grid">
		{#each visibleGroups as group (group.id)}
			<GroupCard
				{group}
				items={itemsFor(group.id, group.id === `${category.id}-sem-grupo`)}
				color={category.color}
			/>
		{/each}
	</div>
	{#if visibleGroups.length === 0}
		<p class="muted">Nenhum grupo nesta categoria.</p>
	{/if}
</section>

<FeedBoard
	{entries}
	title={`Feed de ${category.name}`}
	savedFilters={data.hub.savedFilters}
	contextNote={`Só fontes desta categoria · ${sourceCount} fontes`}
/>
