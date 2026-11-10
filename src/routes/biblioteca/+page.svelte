<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from '#lib/components/Icon.svelte';
	import LibraryCard from '#lib/components/LibraryCard.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
	import type { Category, HubItem } from '#lib/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const hub = $derived(data.hub);

	type Tab = 'todos' | 'app' | 'link';
	let tab = $state<Tab>('todos');
	let query = $state('');

	const appCount = $derived(hub.items.filter((item) => item.type === 'app').length);
	const linkCount = $derived(hub.items.filter((item) => item.type === 'link').length);
	const sortedCategories = $derived([...hub.categories].sort((a, b) => a.order - b.order));

	function normalize(value: string): string {
		return value
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase();
	}

	const terms = $derived(
		normalize(query)
			.trim()
			.split(/\s+/)
			.filter((term) => term.length > 0)
	);

	function matches(item: HubItem, category: Category, groupName: string): boolean {
		if (tab === 'app' && item.type !== 'app') return false;
		if (tab === 'link' && item.type !== 'link') return false;
		if (terms.length === 0) return true;

		const haystack = normalize(
			[item.name, category.name, groupName, item.tags.join(' ')].join('\n')
		);
		return terms.every((term) => haystack.includes(term));
	}

	const sections = $derived.by(() => {
		return sortedCategories
			.map((category) => {
				const groups = hub.groups
					.filter((group) => group.categoryId === category.id)
					.sort((a, b) => a.order - b.order)
					.map((group) => ({
						id: group.id,
						name: group.name,
						items: hub.items
							.filter(
								(item) =>
									item.categoryId === category.id &&
									item.groupId === group.id &&
									matches(item, category, group.name)
							)
							.sort((a, b) => a.order - b.order)
					}))
					.filter((group) => group.items.length > 0);

				const ungrouped = hub.items
					.filter(
						(item) =>
							item.categoryId === category.id &&
							!item.groupId &&
							matches(item, category, 'Sem grupo')
					)
					.sort((a, b) => a.order - b.order);

				if (ungrouped.length > 0) {
					groups.push({ id: '__sem-grupo', name: 'Sem grupo', items: ungrouped });
				}

				return {
					category,
					groups,
					total: groups.reduce((sum, group) => sum + group.items.length, 0)
				};
			})
			.filter((section) => section.total > 0);
	});

	const visibleCount = $derived(sections.reduce((sum, section) => sum + section.total, 0));
</script>

<svelte:head>
	<title>Biblioteca · Meu Hub</title>
</svelte:head>

<TopBar placeholder="Buscar na biblioteca" action="Adicionar item" />

<div class="section-head">
	<h1>Biblioteca</h1>
	<span class="muted small">
		{hub.items.length} itens · {appCount} apps do PC · {linkCount} links no navegador
	</span>
</div>

<div class="tabs" role="tablist" aria-label="Filtrar a biblioteca por plataforma">
	<button
		class="tab"
		class:active={tab === 'todos'}
		type="button"
		role="tab"
		aria-selected={tab === 'todos'}
		onclick={() => (tab = 'todos')}
	>
		Todos · {hub.items.length}
	</button>
	<button
		class="tab"
		class:active={tab === 'app'}
		type="button"
		role="tab"
		aria-selected={tab === 'app'}
		onclick={() => (tab = 'app')}
	>
		Apps do PC · {appCount}
	</button>
	<button
		class="tab"
		class:active={tab === 'link'}
		type="button"
		role="tab"
		aria-selected={tab === 'link'}
		onclick={() => (tab = 'link')}
	>
		Navegador · {linkCount}
	</button>
</div>

<div class="filter-panel">
	<div class="filter-row">
		<div class="filter-input">
			<Icon name="search" size={16} />
			<label class="sr-only" for="library-search">Buscar na biblioteca</label>
			<input
				id="library-search"
				bind:value={query}
				placeholder="Buscar por nome, grupo, categoria ou tag"
			/>
		</div>
		<span class="muted small">
			{visibleCount}
			{visibleCount === 1 ? 'item' : 'itens'} encontrados
		</span>
		{#if query}
			<button class="chip" type="button" onclick={() => (query = '')}>Limpar busca</button>
		{/if}
	</div>
</div>

{#each sections as section (section.category.id)}
	<section class="library-category" aria-labelledby={`library-cat-${section.category.id}`}>
		<div class="section-head">
			<h2 id={`library-cat-${section.category.id}`} class="library-category-title">
				<span class="dot" style="background: {section.category.color}"></span>
				{section.category.name}
			</h2>
			<span class="muted small">{section.total} itens</span>
		</div>

		{#each section.groups as group (group.id)}
			<div class="library-group">
				<div class="library-group-head">
					<span class="library-group-name">{group.name}</span>
					<span class="muted small">{group.items.length} serviços</span>
					<a
						class="library-group-edit"
						href={resolve('/gerenciar')}
						title="Gerenciar grupos e itens"
					>
						editar
					</a>
				</div>
				<div class="library-grid">
					{#each group.items as item (item.id)}
						<LibraryCard {item} color={section.category.color} />
					{/each}
				</div>
			</div>
		{/each}
	</section>
{/each}

{#if sections.length === 0}
	<div class="placeholder-panel">
		<span class="placeholder-title">Nenhum item encontrado</span>
		<span class="muted">
			{#if query}
				Ajuste a busca ou limpe o filtro para ver todos os itens.
			{:else}
				Cadastre links e apps em Gerenciar → Links / Apps do PC.
			{/if}
		</span>
		<div class="chips">
			{#if query}
				<button class="chip" type="button" onclick={() => (query = '')}>Limpar busca</button>
			{:else}
				<a class="chip link" href={resolve('/gerenciar')}>Ir para Gerenciar</a>
			{/if}
		</div>
	</div>
{/if}
