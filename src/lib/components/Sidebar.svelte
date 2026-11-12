<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { categoryItemCounts, categorySourceCounts } from '#lib/display';
	import type { HubData } from '#lib/types';
	import { ui } from '#lib/ui.svelte';
	import Icon from './Icon.svelte';

	let {
		hub,
		unread = 0,
		unreadByCategory = {},
		savedCount = 0
	}: {
		hub: HubData;
		unread?: number;
		unreadByCategory?: Record<string, number>;
		savedCount?: number;
	} = $props();

	const path = $derived(page.url.pathname);
	const categories = $derived([...hub.categories].sort((a, b) => a.order - b.order));
	const counts = $derived(categoryItemCounts(hub));
	const sourceCounts = $derived(categorySourceCounts(hub));

	function active(href: string): boolean {
		return href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
	}
</script>

<nav class="sidebar" aria-label="Menu principal">
	<div class="sidebar-scroll">
		<div class="brand-row">
			<a class="brand" href={resolve('/')}>
				<span class="brand-mark">H</span>
				<span>Meu Hub</span>
			</a>
			<a class="brand-gear" href={resolve('/gerenciar')} aria-label="Gerenciar" title="Gerenciar">
				<Icon name="settings" size={18} />
			</a>
		</div>

		<div class="nav">
			<a class="nav-link" class:active={active('/')} href={resolve('/')}>
				<Icon name="home" />
				Início
			</a>
			<a class="nav-link" class:active={active('/feed')} href={resolve('/feed')}>
				<Icon name="rss" />
				Feed completo
				{#if unread > 0}
					<span class="badge">{unread}</span>
				{/if}
			</a>
			<a class="nav-link" class:active={active('/favoritos')} href={resolve('/favoritos')}>
				<Icon name="star" />
				Favoritos
				{#if savedCount > 0}
					<span class="badge">{savedCount}</span>
				{/if}
			</a>
			<a class="nav-link" class:active={active('/biblioteca')} href={resolve('/biblioteca')}>
				<Icon name="monitor" />
				Biblioteca
			</a>
		</div>

		<div class="nav-section">
			<div class="section-title">Categorias</div>
			{#each categories as cat (cat.id)}
				<a
					class="cat-link"
					class:active={path === `/c/${cat.id}`}
					href={resolve('/c/[slug]', { slug: cat.id })}
				>
					<span class="dot" style="background: {cat.color}"></span>
					<span>{cat.name}</span>
					<span
						class="cat-count"
						title="{counts[cat.id] ?? 0} itens · {sourceCounts[cat.id] ?? 0} fontes de feed"
					>
						{counts[cat.id] ?? 0}
						{#if sourceCounts[cat.id]}
							<span class="cat-feed-count">· {sourceCounts[cat.id]}</span>
						{/if}
					</span>
					<span class="sr-only">
						{counts[cat.id] ?? 0} itens, {sourceCounts[cat.id] ?? 0} fontes de feed,
						{unreadByCategory[cat.id] ?? 0} não lidos
					</span>
					{#if unreadByCategory[cat.id]}
						<span class="cat-unread" title="{unreadByCategory[cat.id]} não lidos">
							{unreadByCategory[cat.id]}
						</span>
					{/if}
				</a>
			{/each}
			<a
				class="nav-link"
				href={resolve('/gerenciar') + '?tab=categorias&add=1'}
				title="Crie categorias em Gerenciar"
			>
				<Icon name="plus" size={16} />
				Nova categoria
			</a>
			<button
				class="nav-link nav-button"
				type="button"
				title="Adicionar um link já com título e descrição"
				onclick={() => ui.openQuickAdd()}
			>
				<Icon name="plus" size={16} />
				Adicionar rápido
			</button>
		</div>
	</div>

	<div class="sidebar-footer">
		<a class="nav-link" class:active={active('/gerenciar')} href={resolve('/gerenciar')}>
			<Icon name="settings" />
			Gerenciar
		</a>
		<div class="sidebar-footnote">Feed com atualização automática</div>
	</div>
</nav>

<style>
	.nav-button {
		width: 100%;
		background: none;
		border: 0;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
</style>
