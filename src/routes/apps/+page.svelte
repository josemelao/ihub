<script lang="ts">
	import TopBar from '#lib/components/TopBar.svelte';
	import { initials, tint } from '#lib/display';
	import type { AppItem } from '#lib/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const hub = $derived(data.hub);

	const groups = $derived(
		[...hub.categories]
			.sort((a, b) => a.order - b.order)
			.map((category) => ({
				category,
				items: hub.items
					.filter((item): item is AppItem => item.type === 'app' && item.categoryId === category.id)
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
		<div class="section-head">
			<h2 id={`apps-${group.category.id}`} style="font-size: 15px">{group.category.name}</h2>
			<span class="muted small">{group.items.length} apps</span>
		</div>
		<div class="app-grid">
			{#each group.items as item (item.id)}
				<a
					class="app-card"
					href={item.launch.value}
					title={`Abrir ${item.name}`}
					aria-label={`Abrir ${item.name}`}
				>
					<span
						class="item-avatar"
						style="background: {tint(group.category.color, 0.16)}; color: {group.category.color}"
					>
						{initials(item.name)}
					</span>
					<span class="manage-main">
						<span class="manage-name">{item.name}</span>
						<span class="manage-sub">{item.launch.value}</span>
					</span>
					<span class="app-open">Abrir</span>
				</a>
			{/each}
		</div>
	</section>
{/each}

{#if groups.length === 0}
	<div class="placeholder-panel">
		<span class="placeholder-title">Nenhum app cadastrado</span>
		<span class="muted"
			>Adicione itens com <code>"type": "app"</code> em Gerenciar → Apps do PC.</span
		>
	</div>
{/if}

<div class="placeholder-panel">
	<span class="placeholder-title">Abrir por comando (futuro)</span>
	<span class="muted">
		Por segurança, a V1 só abre apps por protocolo. Comandos locais exigirão lista permitida. Na
		primeira vez, o navegador pode pedir confirmação para abrir o app.
	</span>
</div>
