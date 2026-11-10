<script lang="ts">
	import { resolve } from '$app/paths';
	import { itemHref, itemKind } from '#lib/display';
	import type { HubData } from '#lib/types';
	import ItemIcon from './ItemIcon.svelte';

	let {
		hub,
		title = 'Acesso rápido',
		stacked = false,
		grid = false,
		limit
	}: { hub: HubData; title?: string; stacked?: boolean; grid?: boolean; limit?: number } = $props();

	const colors = $derived(Object.fromEntries(hub.categories.map((cat) => [cat.id, cat.color])));
	const quick = $derived(
		hub.items
			.filter((item) => item.pinned)
			.sort((a, b) => a.order - b.order)
			.slice(0, limit ?? undefined)
	);
</script>

<section class="section" aria-labelledby="t-rapido">
	<div class="section-head">
		<h2 id="t-rapido">{title}</h2>
		<a class="muted small" href={resolve('/gerenciar')}>Editar atalhos</a>
	</div>
	<div class="quick-grid" class:stacked class:grid>
		{#each quick as item (item.id)}
			{@const color = colors[item.categoryId] ?? '#8AA4FF'}
			<a
				class="quick-tile"
				href={itemHref(item)}
				target={item.type === 'link' ? '_blank' : undefined}
				rel="noopener noreferrer"
			>
				<ItemIcon {item} {color} size={34} />
				<span class="quick-meta">
					<span class="quick-name">{item.name}</span>
					<span class="quick-kind">{itemKind(item)}</span>
				</span>
			</a>
		{/each}
		{#if quick.length === 0}
			<p class="muted">
				Nenhum atalho fixado ainda. Marque itens com <code>pinned: true</code> no hub.json.
			</p>
		{/if}
	</div>
</section>
