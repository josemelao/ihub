<script lang="ts">
	import { ui } from '#lib/ui.svelte';
	import Icon from './Icon.svelte';

	let {
		placeholder = 'Buscar links, apps e posts do feed',
		action = 'Adicionar',
		actionTitle = 'Disponível na V3'
	}: { placeholder?: string; action?: string; actionTitle?: string } = $props();
</script>

<header class="topbar">
	<button
		class="search search-button"
		type="button"
		onclick={() => ui.openPalette()}
		aria-label={`Abrir busca rápida (Ctrl K): ${placeholder}`}
	>
		<Icon name="search" />
		<span class="search-text">{placeholder}</span>
		<span class="kbd" aria-hidden="true">Ctrl K</span>
	</button>
	<div class="topbar-actions">
		<button class="btn" type="button" disabled title="Modo edição chega na V3">Modo edição</button>
		<button class="btn btn-primary" type="button" disabled title={actionTitle}>
			<Icon name="plus" size={16} />
			{action}
		</button>
	</div>
</header>
