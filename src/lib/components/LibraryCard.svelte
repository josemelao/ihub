<script lang="ts">
	import { itemHref, itemPlatform } from '#lib/display';
	import type { HubItem } from '#lib/types';
	import ItemIcon from './ItemIcon.svelte';

	let {
		item,
		color,
		onpin
	}: { item: HubItem; color: string; onpin?: (id: string, pinned: boolean) => void } = $props();

	function detail(): string {
		if (item.description) return item.description;
		if (item.type === 'app') return item.launch.value;
		try {
			return new URL(item.url).hostname.replace(/^www\./, '');
		} catch {
			return item.url;
		}
	}
</script>

<div class="library-card-wrap">
	<a
		class="library-card"
		href={itemHref(item)}
		target={item.type === 'link' ? '_blank' : undefined}
		rel="noopener noreferrer"
		title={`Abrir ${item.name}`}
	>
		<ItemIcon {item} {color} size={40} />
		<span class="library-card-main">
			<span class="library-card-name">{item.name}</span>
			<span class="library-card-meta">{detail()}</span>
		</span>
		<span class="library-badge" class:pc={item.type === 'app'}>
			{itemPlatform(item)}
		</span>
	</a>
	{#if onpin}
		<button
			class="library-pin"
			type="button"
			class:pinned={item.pinned}
			aria-pressed={item.pinned}
			aria-label={item.pinned
				? `Desafixar ${item.name} do Acesso rápido`
				: `Fixar ${item.name} no Acesso rápido`}
			title={item.pinned ? 'Desafixar do Acesso rápido' : 'Fixar no Acesso rápido'}
			onclick={() => onpin(item.id, !item.pinned)}
		>
			{item.pinned ? '★' : '☆'}
		</button>
	{/if}
</div>
