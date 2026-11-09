<script lang="ts">
	import Icon from './Icon.svelte';

	let {
		placeholder = 'Buscar links, apps e posts do feed',
		action = 'Adicionar',
		actionTitle = 'Disponível na V3'
	}: { placeholder?: string; action?: string; actionTitle?: string } = $props();
</script>

<header class="topbar">
	<div class="search">
		<Icon name="search" />
		<label class="sr-only" for="busca">{placeholder}</label>
		<input
			id="busca"
			type="text"
			{placeholder}
			title="A busca Ctrl K chega na próxima etapa"
			autocomplete="off"
		/>
		<span class="kbd">Ctrl K</span>
	</div>
	<div class="topbar-actions">
		<button class="btn" type="button" disabled title="Modo edição chega na V3">Modo edição</button>
		<button class="btn btn-primary" type="button" disabled title={actionTitle}>
			<Icon name="plus" size={16} />
			{action}
		</button>
	</div>
</header>
