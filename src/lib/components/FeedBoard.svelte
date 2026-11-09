<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { masonry } from '#lib/actions/masonry';
	import { matchesFilter } from '#lib/feed/filter';
	import type { FeedViewItem } from '#lib/feed/view';
	import type { Category, SavedFilter } from '#lib/types';
	import FeedCard from './FeedCard.svelte';
	import Icon from './Icon.svelte';

	type FeedView = 'bento' | 'compact' | 'grid';

	let {
		entries,
		savedFilters = [],
		categories = [],
		title,
		showCategoryChips = false,
		contextNote = ''
	}: {
		entries: FeedViewItem[];
		savedFilters?: SavedFilter[];
		categories?: Category[];
		title: string;
		showCategoryChips?: boolean;
		contextNote?: string;
	} = $props();

	const viewOptions: { id: FeedView; label: string }[] = [
		{ id: 'bento', label: 'Bento' },
		{ id: 'compact', label: 'Compacto' },
		{ id: 'grid', label: 'Grade' }
	];

	let view = $state<FeedView>('bento');
	let query = $state('');
	let modeChoice = $state<'any' | 'all'>('any');
	let activeFilterId = $state<string | null>(null);
	let unreadOnly = $state(false);
	let categoryFilter = $state('all');
	let limit = $state(10);
	let refreshing = $state(false);
	let refreshMessage = $state('');
	let refreshFailed = $state(false);

	onMount(() => {
		const saved = localStorage.getItem('meu-hub:feed-view');
		if (saved === 'bento' || saved === 'compact' || saved === 'grid') {
			view = saved;
		}
	});

	function setView(next: FeedView): void {
		view = next;
		localStorage.setItem('meu-hub:feed-view', next);
	}

	const activeFilter = $derived(
		savedFilters.find((filter) => filter.id === activeFilterId) ?? null
	);
	const queryTerms = $derived(query.trim().split(/\s+/).filter(Boolean));
	const terms = $derived(activeFilter ? activeFilter.include : queryTerms);
	const exclude = $derived(activeFilter?.exclude ?? []);
	const mode = $derived(activeFilter?.matchMode ?? modeChoice);

	const base = $derived(
		categoryFilter === 'all'
			? entries
			: entries.filter((entry) => entry.source.categoryId === categoryFilter)
	);
	const filtered = $derived(
		base.filter((entry) => {
			if (unreadOnly && entry.read) return false;
			return matchesFilter(`${entry.item.title}\n${entry.item.summary}`, terms, exclude, mode);
		})
	);
	const visible = $derived(filtered.slice(0, limit));

	function countFor(filter: SavedFilter): number {
		return base.filter((entry) =>
			matchesFilter(
				`${entry.item.title}\n${entry.item.summary}`,
				filter.include,
				filter.exclude,
				filter.matchMode
			)
		).length;
	}

	function resetLimit(): void {
		limit = 10;
	}

	function selectFilter(id: string): void {
		activeFilterId = activeFilterId === id ? null : id;
		resetLimit();
	}

	async function postState(body: unknown): Promise<void> {
		const response = await fetch('/api/state', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (response.ok) await invalidateAll();
	}

	function toggleRead(entry: FeedViewItem): void {
		void postState({ action: entry.read ? 'unread' : 'read', id: entry.item.id });
	}

	function toggleSave(entry: FeedViewItem): void {
		void postState({ action: entry.saved ? 'unsave' : 'save', id: entry.item.id });
	}

	function markAllRead(): void {
		const ids = filtered.filter((entry) => !entry.read).map((entry) => entry.item.id);
		if (ids.length > 0) void postState({ action: 'mark-all-read', ids });
	}

	async function refresh(): Promise<void> {
		refreshing = true;
		refreshMessage = '';
		refreshFailed = false;

		try {
			const response = await fetch('/api/refresh', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: '{}'
			});
			const result = (await response.json()) as {
				ok?: boolean;
				error?: string;
				results?: { ok: boolean; name: string }[];
			};

			if (!result.ok) {
				refreshMessage = result.error ?? 'Falha ao atualizar o feed.';
				refreshFailed = true;
			} else {
				const failed = (result.results ?? []).filter((entry) => !entry.ok);
				refreshFailed = failed.length > 0;
				refreshMessage =
					failed.length > 0
						? `Atualizado com falha em: ${failed.map((entry) => entry.name).join(', ')}`
						: 'Feed atualizado.';
			}
			await invalidateAll();
		} catch {
			refreshMessage = 'Falha de rede ao atualizar o feed.';
			refreshFailed = true;
		} finally {
			refreshing = false;
		}
	}
</script>

<section class="section" aria-labelledby="t-feed">
	<div class="section-head">
		<div>
			<h2 id="t-feed">{title}</h2>
			{#if contextNote}
				<span class="muted small">{contextNote}</span>
			{/if}
		</div>
		<div class="chips">
			<div class="chips view-switch" role="group" aria-label="Visualização do feed">
				{#each viewOptions as option (option.id)}
					<button
						class="chip"
						class:active={view === option.id}
						type="button"
						aria-pressed={view === option.id}
						onclick={() => setView(option.id)}
					>
						{option.label}
					</button>
				{/each}
			</div>
			<button class="chip link" type="button" onclick={markAllRead}>Marcar tudo como lido</button>
			<button class="chip link" type="button" onclick={refresh} disabled={refreshing}>
				{refreshing ? 'Atualizando...' : 'Atualizar agora'}
			</button>
		</div>
	</div>

	{#if refreshMessage}
		<div class:alert={refreshFailed} class:notice={!refreshFailed} role="status">
			{refreshMessage}
		</div>
	{/if}

	<div class="filter-panel">
		<div class="filter-row">
			<div class="filter-input">
				<Icon name="filter" size={16} />
				<label class="sr-only" for="kw">Filtrar por palavra-chave</label>
				<input
					id="kw"
					type="text"
					placeholder="Filtrar por palavra-chave (ex.: patch, hotfix)"
					bind:value={query}
					oninput={() => {
						activeFilterId = null;
						resetLimit();
					}}
				/>
			</div>
			<div class="chips">
				<button
					class="chip"
					class:active={mode === 'any'}
					type="button"
					aria-pressed={mode === 'any'}
					onclick={() => {
						modeChoice = 'any';
						activeFilterId = null;
					}}
				>
					Qualquer palavra
				</button>
				<button
					class="chip"
					class:active={mode === 'all'}
					type="button"
					aria-pressed={mode === 'all'}
					onclick={() => {
						modeChoice = 'all';
						activeFilterId = null;
					}}
				>
					Todas
				</button>
			</div>
		</div>

		{#if savedFilters.length > 0}
			<div class="chips">
				<span class="muted small">Filtros salvos</span>
				{#each savedFilters as filter (filter.id)}
					<button
						class="chip"
						class:active={activeFilterId === filter.id}
						type="button"
						aria-pressed={activeFilterId === filter.id}
						onclick={() => selectFilter(filter.id)}
					>
						{filter.label} · {countFor(filter)}
					</button>
				{/each}
				<a class="chip link" href={resolve('/gerenciar')}>+ Salvar filtro</a>
			</div>
		{/if}

		<div class="chips" style="padding-top: 10px; border-top: 1px solid var(--line)">
			{#if showCategoryChips}
				<button
					class="chip"
					class:solid={categoryFilter === 'all'}
					type="button"
					aria-pressed={categoryFilter === 'all'}
					onclick={() => {
						categoryFilter = 'all';
						resetLimit();
					}}
				>
					Tudo
				</button>
				{#each [...categories].sort((a, b) => a.order - b.order) as category (category.id)}
					<button
						class="chip"
						class:active={categoryFilter === category.id}
						type="button"
						aria-pressed={categoryFilter === category.id}
						onclick={() => {
							categoryFilter = category.id;
							resetLimit();
						}}
					>
						{category.name}
					</button>
				{/each}
			{/if}
			<button
				class="chip"
				class:active={unreadOnly}
				type="button"
				aria-pressed={unreadOnly}
				onclick={() => {
					unreadOnly = !unreadOnly;
					resetLimit();
				}}
			>
				Não lidos
			</button>
			<span class="muted small" style="margin-left: auto">
				Mostrando {Math.min(limit, filtered.length)} de {filtered.length} posts
			</span>
		</div>
	</div>

	<div class="feed-container">
		<div
			class="feed-layout"
			class:bento={view === 'bento'}
			class:grid-view={view === 'grid'}
			class:compact-view={view === 'compact'}
			use:masonry={{ enabled: view === 'bento', gap: 12 }}
		>
			{#each visible as entry (entry.item.id)}
				<FeedCard
					{entry}
					{terms}
					variant={view}
					onread={() => toggleRead(entry)}
					onsave={() => toggleSave(entry)}
				/>
			{/each}
		</div>
	</div>

	{#if filtered.length === 0}
		<div class="placeholder-panel">
			<span class="placeholder-title">
				{entries.length === 0 ? 'Nenhum post no cache ainda' : 'Nenhum post com esse filtro'}
			</span>
			<span class="muted">
				{entries.length === 0
					? 'Clique em "Atualizar agora" para buscar as fontes cadastradas.'
					: 'Ajuste a palavra-chave, o modo ou os filtros salvos.'}
			</span>
		</div>
	{/if}

	{#if limit < filtered.length}
		<button class="btn" type="button" style="align-self: center" onclick={() => (limit += 10)}>
			Carregar mais
		</button>
	{/if}
</section>
