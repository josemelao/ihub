<script lang="ts">
	import { resolve } from '$app/paths';
	import { ui } from '#lib/ui.svelte';
	import Icon from './Icon.svelte';

	let {
		placeholder = 'Buscar links, apps e posts do feed',
		action = 'Adicionar',
		actionTitle = 'Abre o gerenciador',
		actionHref = resolve('/gerenciar')
	}: {
		placeholder?: string;
		action?: string;
		actionTitle?: string;
		actionHref?: string;
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
	<button
		class="search search-button"
		type="button"
		onclick={() => ui.openPalette()}
		title="Abrir busca rápida (Ctrl K)"
	>
		<Icon name="search" />
		<span class="search-text">{placeholder}</span>
		<span class="kbd" aria-hidden="true">Ctrl K</span>
	</button>
	<div class="topbar-actions">
		<a class="btn" href={resolve('/gerenciar')} title={actionTitle}>Editar</a>
		<a class="btn btn-primary" href={actionHref} title={actionTitle}>
			<Icon name="plus" size={16} />
			{action}
		</a>
	</div>
</header>
