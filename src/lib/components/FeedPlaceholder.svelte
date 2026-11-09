<script lang="ts">
	import type { Category, SavedFilter } from '#lib/types';
	import Icon from './Icon.svelte';

	let {
		title = 'Seu feed',
		savedFilters = [],
		categories = [],
		counter = 'Mostrando 0 de 0 posts'
	}: {
		title?: string;
		savedFilters?: SavedFilter[];
		categories?: Category[];
		counter?: string;
	} = $props();
</script>

<section class="section" aria-labelledby="t-feed">
	<div class="section-head">
		<h2 id="t-feed">{title}</h2>
		<button class="chip link" type="button" disabled title="Disponível na V2">
			Marcar tudo como lido
		</button>
	</div>

	<div class="filter-panel">
		<div class="filter-row">
			<div class="filter-input">
				<Icon name="filter" size={16} />
				<label class="sr-only" for="kw">Filtrar por palavra-chave</label>
				<input
					id="kw"
					type="text"
					placeholder="Filtrar por palavra-chave (ex.: patch, hotfix)"
					disabled
				/>
			</div>
			<div class="chips">
				<button class="chip" type="button" disabled>Qualquer palavra</button>
				<button class="chip" type="button" disabled>Todas</button>
			</div>
		</div>

		{#if savedFilters.length > 0}
			<div class="chips">
				<span class="muted small">Filtros salvos</span>
				{#each savedFilters as filter (filter.id)}
					<button class="chip" type="button" disabled>{filter.label}</button>
				{/each}
				<button class="chip link" type="button" disabled>+ Salvar filtro</button>
			</div>
		{/if}

		<div class="chips" style="padding-top: 10px; border-top: 1px solid var(--line)">
			<span class="chip solid">Tudo</span>
			{#each categories as cat (cat.id)}
				<span class="chip">{cat.name}</span>
			{/each}
			<span class="chip">Não lidos</span>
			<span class="muted small" style="margin-left: auto">{counter}</span>
		</div>
	</div>

	<div class="placeholder-panel">
		<span class="placeholder-title">Feed disponível na V2</span>
		<span class="muted">
			A estrutura, os filtros salvos e as fontes já estão no <code>hub.json</code>. A busca e a
			atualização automática de RSS, YouTube e Reddit entram no marco M3.
		</span>
	</div>
</section>
