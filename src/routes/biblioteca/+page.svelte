<script lang="ts">
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Icon from '#lib/components/Icon.svelte';
	import LibraryCard from '#lib/components/LibraryCard.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
	import { matchesLibraryItem, searchTerms } from '#lib/library-filter';
	import { collectTags, tagKey } from '#lib/tags';
	import type { HubItem } from '#lib/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const hub = $derived(data.hub);

	type Tab = 'todos' | 'app' | 'link';
	let tab = $state<Tab>('todos');
	let query = $state('');
	let activeTagKey = $state(tagKey(page.url.searchParams.get('tag') ?? ''));

	const tags = $derived(collectTags(hub));

	const STORAGE_KEY = 'meu-hub:library-collapsed';

	let collapsed = $state<Record<string, boolean>>({});
	let reduceMotion = $state(false);
	let motionEnabled = $state(false);
	let searchSnapshot: Record<string, boolean> | null = null;
	let wasSearching = false;

	onMount(() => {
		reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) collapsed = JSON.parse(raw) as Record<string, boolean>;
		} catch {
			collapsed = {};
		}
		const timer = setTimeout(() => {
			motionEnabled = true;
		}, 300);
		return () => clearTimeout(timer);
	});

	onMount(() => {
		const syncFromUrl = (): void => {
			const param = new URL(window.location.href).searchParams.get('tag') ?? '';
			activeTagKey = param ? tagKey(param) : '';
		};
		window.addEventListener('popstate', syncFromUrl);
		return () => window.removeEventListener('popstate', syncFromUrl);
	});

	const motionDuration = $derived(reduceMotion || !motionEnabled ? 0 : 220);

	const appCount = $derived(hub.items.filter((item) => item.type === 'app').length);
	const linkCount = $derived(hub.items.filter((item) => item.type === 'link').length);
	const sortedCategories = $derived([...hub.categories].sort((a, b) => a.order - b.order));

	const terms = $derived(searchTerms(query));

	function matches(item: HubItem, categoryName: string, groupName: string): boolean {
		return matchesLibraryItem(item, categoryName, groupName, {
			tab,
			query,
			tagKey: activeTagKey
		});
	}

	async function selectTag(tag: string): Promise<void> {
		activeTagKey = tag ? tagKey(tag) : '';
		const url = new URL(page.url.href);
		if (tag) url.searchParams.set('tag', tag);
		else url.searchParams.delete('tag');
		await goto(`${url.pathname}${url.search}`, { shallow: true });
	}

	let lastTagParam: string | null = null;

	$effect(() => {
		const param = page.url.searchParams.get('tag') ?? '';
		if (param === lastTagParam) return;
		lastTagParam = param;
		activeTagKey = param ? tagKey(param) : '';
	});

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
									matches(item, category.name, group.name)
							)
							.sort((a, b) => a.order - b.order)
					}))
					.filter((group) => group.items.length > 0);

				const ungrouped = hub.items
					.filter(
						(item) =>
							item.categoryId === category.id &&
							!item.groupId &&
							matches(item, category.name, 'Sem grupo')
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
	const allCollapsed = $derived(
		sections.length > 0 && sections.every((section) => collapsed[section.category.id])
	);

	function persistCollapse(): void {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsed));
		} catch {
			// localStorage indisponível: o estado vale só nesta sessão
		}
	}

	function toggleCategory(id: string): void {
		collapsed = { ...collapsed, [id]: !collapsed[id] };
		if (terms.length === 0) persistCollapse();
	}

	function toggleAll(): void {
		if (allCollapsed) {
			collapsed = {};
		} else {
			const next = { ...collapsed };
			for (const section of sections) next[section.category.id] = true;
			collapsed = next;
		}
		if (terms.length === 0) persistCollapse();
	}

	// Ao buscar, expande tudo; ao limpar, restaura o estado anterior.
	$effect(() => {
		const searching = terms.length > 0;
		if (searching === wasSearching) return;
		wasSearching = searching;

		if (searching) {
			searchSnapshot = { ...collapsed };
			collapsed = {};
		} else if (searchSnapshot) {
			collapsed = searchSnapshot;
			searchSnapshot = null;
		}
	});
</script>

<svelte:head>
	<title>Biblioteca · Meu Hub</title>
</svelte:head>

<TopBar
	placeholder="Buscar na biblioteca"
	action="Adicionar item"
	actionHref={`${resolve('/gerenciar')}?tab=itens&add=link`}
/>

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

{#if tags.length > 0 || activeTagKey}
	<div class="chips" role="group" aria-label="Filtrar por tag">
		<button
			class="chip"
			class:active={!activeTagKey}
			type="button"
			aria-pressed={!activeTagKey}
			onclick={() => selectTag('')}
		>
			Todas
		</button>
		{#each tags as tag (tag.key)}
			<button
				class="chip"
				class:active={activeTagKey === tag.key}
				type="button"
				aria-pressed={activeTagKey === tag.key}
				onclick={() => selectTag(tag.tag)}
			>
				{tag.tag} · {tag.count}
			</button>
		{/each}
	</div>
{/if}

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
		{#if sections.length > 0}
			<button class="chip" type="button" onclick={toggleAll}>
				{allCollapsed ? 'Expandir tudo' : 'Recolher tudo'}
			</button>
		{/if}
		{#if query}
			<button class="chip" type="button" onclick={() => (query = '')}>Limpar busca</button>
		{/if}
		{#if activeTagKey}
			<button class="chip" type="button" onclick={() => selectTag('')}>Limpar tag</button>
		{/if}
	</div>
</div>

{#each sections as section (section.category.id)}
	{@const isCollapsed = Boolean(collapsed[section.category.id])}
	<section class="library-category" aria-labelledby={`library-cat-${section.category.id}`}>
		<div class="section-head">
			<h2 id={`library-cat-${section.category.id}`} class="library-category-title">
				<button
					class="library-category-toggle"
					type="button"
					aria-expanded={!isCollapsed}
					aria-controls={isCollapsed ? undefined : `library-cat-body-${section.category.id}`}
					onclick={() => toggleCategory(section.category.id)}
				>
					<Icon name={isCollapsed ? 'chevron-right' : 'chevron-down'} size={16} />
					<span class="dot" style="background: {section.category.color}"></span>
					<span>{section.category.name}</span>
				</button>
			</h2>
			<span class="muted small">{section.total} itens · {section.groups.length} grupos</span>
		</div>

		{#if !isCollapsed}
			<div
				id={`library-cat-body-${section.category.id}`}
				class="library-category-body"
				transition:slide={{ duration: motionDuration }}
			>
				{#each section.groups as group (group.id)}
					<div class="library-group">
						<div class="library-group-head">
							<span class="library-group-name">{group.name}</span>
							<span class="muted small">{group.items.length} serviços</span>
							<a
								class="library-group-edit"
								href={resolve('/gerenciar') + '?tab=grupos&focus=' + group.id}
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
			</div>
		{/if}
	</section>
{/each}

{#if sections.length === 0}
	<div class="placeholder-panel">
		<span class="placeholder-title">Nenhum item encontrado</span>
		<span class="muted">
			{#if query || activeTagKey}
				Ajuste a busca, a tag ou limpe os filtros para ver todos os itens.
			{:else}
				Cadastre links e apps em Gerenciar → Links / Apps do PC.
			{/if}
		</span>
		<div class="chips">
			{#if query || activeTagKey}
				<button
					class="chip"
					type="button"
					onclick={() => {
						query = '';
						void selectTag('');
					}}
				>
					Limpar filtros
				</button>
			{:else}
				<a class="chip link" href={resolve('/gerenciar')}>Ir para Gerenciar</a>
			{/if}
		</div>
	</div>
{/if}
