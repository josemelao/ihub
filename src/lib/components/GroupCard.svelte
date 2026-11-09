<script lang="ts">
	import type { Group, HubItem } from '#lib/types';
	import ItemRow from './ItemRow.svelte';

	let { group, items, color }: { group: Group; items: HubItem[]; color: string } = $props();
</script>

<section class="group-card" aria-labelledby={`g-${group.id}`}>
	<div class="group-head">
		<h3 id={`g-${group.id}`}>{group.name}</h3>
		<span class="muted small">{items.length} itens</span>
	</div>
	{#each items as item (item.id)}
		<ItemRow {item} {color} />
	{/each}
	{#if items.length === 0}
		<p class="muted small">Nenhum item neste grupo.</p>
	{/if}
</section>
