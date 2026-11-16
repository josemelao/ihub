<script lang="ts">
	import { resolve } from '$app/paths';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import FeedBoard from '#lib/components/FeedBoard.svelte';
	import LibraryCard from '#lib/components/LibraryCard.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const group = $derived(data.group);
	const category = $derived(data.category);
	const items = $derived(data.items);
	const links = $derived(items.filter((item) => item.type === 'link'));

	let confirming = $state(false);
	let openMessage = $state('');
	let openFailed = $state(false);

	function openAll(): void {
		confirming = false;
		let blocked = 0;

		for (const item of links) {
			const popup = window.open(item.url, '_blank');
			if (popup) popup.opener = null;
			else blocked += 1;
		}

		const opened = links.length - blocked;
		if (blocked > 0) {
			openFailed = true;
			openMessage = `${opened} de ${links.length} links abertos; ${blocked} bloqueado(s) pelo navegador. Permita pop-ups para este site.`;
		} else {
			openFailed = false;
			openMessage = `${opened} ${opened === 1 ? 'link aberto' : 'links abertos'} em novas abas.`;
		}
	}
</script>

<svelte:head>
	<title>{group.name} · Meu Hub</title>
</svelte:head>

<TopBar
	placeholder={`Buscar em ${group.name}`}
	action="Editar grupo"
	actionHref={`${resolve('/gerenciar')}?tab=grupos&focus=${encodeURIComponent(group.id)}`}
/>

<div class="cat-header">
	<div class="cat-identity">
		<div class="cat-title">
			<span class="cat-square" style="background: {category.color}"></span>
			<h1>{group.name}</h1>
		</div>
		<span class="muted">
			{items.length}
			{items.length === 1 ? 'item' : 'itens'} · {data.sources.length}
			{data.sources.length === 1 ? 'fonte de feed' : 'fontes de feed'} · {category.name}
		</span>
	</div>

	<div class="chips">
		<a class="btn" href={resolve('/c/[slug]', { slug: category.id })}>
			Categoria {category.name}
		</a>
		{#if links.length > 0}
			<button class="btn btn-primary" type="button" onclick={() => (confirming = true)}>
				Abrir tudo
			</button>
		{/if}
	</div>
</div>

{#if openMessage}
	<div class:alert={openFailed} class:notice={!openFailed} role="status">{openMessage}</div>
{/if}

<section class="section" aria-labelledby="t-group-links">
	<h2 id="t-group-links">Links e apps</h2>
	{#if items.length > 0}
		<div class="library-grid">
			{#each items as item (item.id)}
				<LibraryCard {item} color={category.color} />
			{/each}
		</div>
	{:else}
		<p class="muted">Nenhum item neste grupo.</p>
	{/if}
</section>

{#if data.sources.length > 0}
	<FeedBoard
		entries={data.entries}
		title={`Feed de ${group.name}`}
		savedFilters={data.hub.savedFilters}
		sources={data.sources}
		contextNote={`Só fontes deste grupo · ${data.sources.length} fontes`}
	/>
{:else}
	<section class="section" aria-labelledby="t-group-feed">
		<h2 id="t-group-feed">Feed de {group.name}</h2>
		<p class="muted">Nenhuma fonte vinculada a este grupo.</p>
	</section>
{/if}

{#if confirming}
	<ConfirmDialog
		title="Abrir todos os links?"
		message={`Isso abre ${links.length} ${links.length === 1 ? 'link' : 'links'} em novas abas. O navegador pode bloquear parte deles.`}
		confirmLabel="Abrir tudo"
		onconfirm={openAll}
		oncancel={() => (confirming = false)}
	/>
{/if}
