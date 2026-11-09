<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { categoryItemCounts } from '#lib/display';
	import type { HubData } from '#lib/types';
	import Icon from './Icon.svelte';

	let { hub }: { hub: HubData } = $props();

	const path = $derived(page.url.pathname);
	const categories = $derived([...hub.categories].sort((a, b) => a.order - b.order));
	const counts = $derived(categoryItemCounts(hub));

	function active(href: string): boolean {
		return href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
	}
</script>

<nav class="sidebar" aria-label="Menu principal">
	<a class="brand" href={resolve('/')}>
		<span class="brand-mark">H</span>
		<span>Meu Hub</span>
	</a>

	<div class="nav">
		<a class="nav-link" class:active={active('/')} href={resolve('/')}>
			<Icon name="home" />
			Início
		</a>
		<a class="nav-link" class:active={active('/feed')} href={resolve('/feed')}>
			<Icon name="rss" />
			Feed completo
		</a>
		<a class="nav-link" class:active={active('/favoritos')} href={resolve('/favoritos')}>
			<Icon name="star" />
			Favoritos
		</a>
		<a class="nav-link" class:active={active('/apps')} href={resolve('/apps')}>
			<Icon name="monitor" />
			Apps do PC
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
				<span class="cat-count">{counts[cat.id] ?? 0}</span>
			</a>
		{/each}
		<button class="nav-link muted" type="button" disabled title="Painel de edição chega na V3">
			<Icon name="plus" size={16} />
			Nova categoria
		</button>
	</div>

	<div class="sidebar-footer">
		<a class="nav-link" class:active={active('/gerenciar')} href={resolve('/gerenciar')}>
			<Icon name="settings" />
			Gerenciar fontes e links
		</a>
		<div class="sidebar-footnote">Feed chega na V2</div>
	</div>
</nav>
