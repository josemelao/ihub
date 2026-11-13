<script lang="ts">
	import { resolve } from '$app/paths';
	import { ui } from '#lib/ui.svelte';
	import Icon from './Icon.svelte';

	let {
		placeholder = 'Buscar links, apps e posts do feed',
		action = 'Adicionar',
		actionTitle = 'Abre o gerenciador',
		actionHref = resolve('/gerenciar'),
		title = '',
		showEdit = true
	}: {
		placeholder?: string;
		action?: string;
		actionTitle?: string;
		actionHref?: string;
		title?: string;
		showEdit?: boolean;
	} = $props();
</script>

<header class="topbar">
	<button
		class="icon-btn nav-toggle"
		type="button"
		aria-label="Abrir menu de navegação"
		aria-expanded={ui.navOpen}
		onclick={() => ui.toggleNav()}
	>
		<span aria-hidden="true">☰</span>
	</button>
	{#if title}
		<span class="topbar-title">{title}</span>
	{/if}
	<button
		class="search-button"
		type="button"
		onclick={() => ui.openPalette()}
		title={`${placeholder} (Ctrl K)`}
	>
		<Icon name="search" />
		<span class="search-text">Buscar</span>
		<span class="kbd" aria-hidden="true">Ctrl K</span>
	</button>
	<div class="topbar-actions">
		{#if showEdit}
			<a class="btn" href={resolve('/gerenciar')} title={actionTitle}>Editar</a>
		{/if}
		<a class="btn btn-primary" href={actionHref} title={actionTitle}>
			<Icon name="plus" size={16} />
			{action}
		</a>
	</div>
</header>
