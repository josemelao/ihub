<script lang="ts">
	import { resolve } from '$app/paths';
	import { initials, itemHref, itemKind, tint } from '#lib/display';
	import type { HubData } from '#lib/types';

	let { hub, title = 'Acesso rápido' }: { hub: HubData; title?: string } = $props();

	const colors = $derived(Object.fromEntries(hub.categories.map((cat) => [cat.id, cat.color])));
	const quick = $derived(hub.items.filter((item) => item.pinned).sort((a, b) => a.order - b.order));
</script>

<section class="section" aria-labelledby="t-rapido">
	<div class="section-head">
		<h2 id="t-rapido">{title}</h2>
		<a class="muted small" href={resolve('/gerenciar')}>Editar atalhos</a>
	</div>
	<div class="quick-grid">
		{#each quick as item (item.id)}
			{@const color = colors[item.categoryId] ?? '#8AA4FF'}
			<a
				class="quick-tile"
				href={itemHref(item)}
				target={item.type === 'link' ? '_blank' : undefined}
				rel="noopener noreferrer"
			>
				<span class="quick-avatar" style="background: {tint(color, 0.16)}; color: {color}">
					{initials(item.name)}
				</span>
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
