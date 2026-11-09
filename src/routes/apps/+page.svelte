<script lang="ts">
	import ItemRow from '#lib/components/ItemRow.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const hub = $derived(data.hub);

	const groups = $derived(
		hub.categories
			.map((category) => ({
				category,
				items: hub.items
					.filter((item) => item.type === 'app' && item.categoryId === category.id)
					.sort((a, b) => a.order - b.order)
			}))
			.filter((group) => group.items.length > 0)
	);

	const total = $derived(hub.items.filter((item) => item.type === 'app').length);
</script>

<svelte:head>
	<title>Apps do PC · Meu Hub</title>
</svelte:head>

<TopBar placeholder="Buscar apps do PC" action="Adicionar app" />

<div class="section-head">
	<h1>Apps do PC</h1>
	<span class="muted small"
		>{total} apps abrem por protocolo (steam://, discord://, vscode://...)</span
	>
</div>

{#each groups as group (group.category.id)}
	<section class="panel section" aria-labelledby={`apps-${group.category.id}`}>
		<h2 id={`apps-${group.category.id}`} style="font-size: 15px">{group.category.name}</h2>
		{#each group.items as item (item.id)}
			<ItemRow {item} color={group.category.color} />
		{/each}
	</section>
{/each}

{#if groups.length === 0}
	<div class="placeholder-panel">
		<span class="placeholder-title">Nenhum app cadastrado</span>
		<span class="muted">Adicione itens com <code>"type": "app"</code> no hub.json.</span>
	</div>
{/if}

<div class="placeholder-panel">
	<span class="placeholder-title">Abrir por comando chega na V2</span>
	<span class="muted">
		Por segurança, a V1 só abre apps por protocolo. Comandos locais exigirão lista permitida.
	</span>
</div>
