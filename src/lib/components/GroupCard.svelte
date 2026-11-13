<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Group, HubItem } from '#lib/types';
	import ItemRow from './ItemRow.svelte';

	let {
		group,
		items,
		color,
		virtual = false
	}: { group: Group; items: HubItem[]; color: string; virtual?: boolean } = $props();
</script>

<section class="group-card" aria-labelledby={`g-${group.id}`}>
	<div class="group-head">
		<div class="group-head-title">
			<h3 id={`g-${group.id}`}>{group.name}</h3>
			<span class="muted small">{items.length} itens</span>
		</div>
		{#if !virtual}
			<a
				class="library-group-edit"
				href={`${resolve('/biblioteca')}?grupo=${encodeURIComponent(group.id)}`}
				title="Abrir este grupo na Biblioteca"
			>
				abrir na biblioteca
			</a>
		{/if}
	</div>
	{#each items as item (item.id)}
		<ItemRow {item} {color} />
	{/each}
	{#if items.length === 0}
		<p class="muted small">Nenhum item neste grupo.</p>
	{/if}
</section>
