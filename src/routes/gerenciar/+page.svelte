<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const hub = $derived(data.hub);
	const catName = $derived(Object.fromEntries(hub.categories.map((cat) => [cat.id, cat.name])));
	const colors = $derived(Object.fromEntries(hub.categories.map((cat) => [cat.id, cat.color])));

	const linkCount = $derived(hub.items.filter((item) => item.type === 'link').length);
	const appCount = $derived(hub.items.filter((item) => item.type === 'app').length);

	const typeLabels: Record<string, string> = {
		rss: 'RSS / Atom',
		youtube: 'YouTube',
		reddit: 'Reddit'
	};
</script>

<svelte:head>
	<title>Gerenciar · Meu Hub</title>
</svelte:head>

<a class="chip link" href={resolve('/')}>
	<Icon name="arrow-left" size={16} />
	Voltar ao início
</a>

<div class="section-head">
	<h1>Gerenciar fontes e links</h1>
	<button class="btn" type="button" disabled title="Importação/exportação chega no M2">
		Importar favoritos / OPML
	</button>
</div>

<div class="tabs">
	<span class="tab active">Fontes do feed · {hub.feedSources.length}</span>
	<span class="tab">Links · {linkCount}</span>
	<span class="tab">Apps do PC · {appCount}</span>
	<span class="tab">Categorias · {hub.categories.length}</span>
	<span class="tab">Regras do feed</span>
</div>

<div class="table">
	<div class="table-head">
		<span class="col-source">Fonte</span>
		<span class="col-type">Tipo</span>
		<span class="col-cat">Categoria</span>
		<span class="col-every">Intervalo</span>
		<span class="col-toggle">Ativa</span>
	</div>

	{#each hub.feedSources as source (source.id)}
		<div class="table-row">
			<div class="col-source">
				<span
					class="item-avatar"
					style="background: {colors[source.categoryId] ?? '#8AA4FF'}22; color: {colors[
						source.categoryId
					] ?? '#8AA4FF'}"
				>
					{source.name.slice(0, 2).toUpperCase()}
				</span>
				<span style="display: flex; flex-direction: column; min-width: 0">
					<span style="font-weight: 500">{source.name}</span>
					<span
						class="muted small"
						style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap"
					>
						{source.target}
					</span>
				</span>
			</div>
			<span class="col-type">{typeLabels[source.type] ?? source.type}</span>
			<span class="col-cat">{catName[source.categoryId] ?? source.categoryId}</span>
			<span class="col-every">
				{source.intervalMinutes >= 60
					? `${source.intervalMinutes / 60} h`
					: `${source.intervalMinutes} min`}
			</span>
			<span class="col-toggle">
				<span
					class="switch"
					class:on={source.enabled}
					title={source.enabled ? 'Ativa' : 'Desligada'}
				>
					<span class="knob"></span>
				</span>
			</span>
		</div>
	{/each}
</div>

<div class="placeholder-panel">
	<span class="placeholder-title">Somente leitura na V1</span>
	<span class="muted">
		Esta tela já reflete o <code>hub.json</code>. O painel "Adicionar", o liga/desliga funcional e a
		detecção automática de RSS chegam na V3. Exportar/importar entra no M2.
	</span>
</div>
