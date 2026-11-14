<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { sortFeedSourcesForDisplay } from '#lib/feed/order';
	import { onMount } from 'svelte';
	import { QUICK_NOTE_ID, quickNoteOf } from '#lib/notes';
	import FeedBoard from '#lib/components/FeedBoard.svelte';
	import HomeStatus from '#lib/components/HomeStatus.svelte';
	import HomeTools from '#lib/components/HomeTools.svelte';
	import QuickAccess from '#lib/components/QuickAccess.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
	import { DEFAULT_QUICK_ACCESS_LIMIT } from '#lib/quick-access';
	import { relativeTime } from '#lib/display';
	import { matchesFilter } from '#lib/feed/filter';
	import { buildFeedView, buildSavedView } from '#lib/feed/view';
	import type { SavedFilter } from '#lib/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const hub = $derived(data.hub);
	const layout = $derived(hub.settings.homeLayout ?? 'stacked');
	const colors = $derived(Object.fromEntries(hub.categories.map((cat) => [cat.id, cat.color])));
	const sources = $derived(
		sortFeedSourcesForDisplay(
			hub.feedSources.filter((source) => source.enabled),
			hub.categories
		)
	);
	const entries = $derived(buildFeedView(hub, data.feed, data.state));
	const savedRecent = $derived(buildSavedView(hub, data.feed, data.state).slice(0, 3));

	let note = $state('');
	let noteStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let noteTimer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		note = quickNoteOf(data.notes)?.text ?? '';
	});

	function onNoteInput(): void {
		noteStatus = 'saving';
		clearTimeout(noteTimer);
		noteTimer = setTimeout(() => void persistNote(), 500);
	}

	async function persistNote(): Promise<void> {
		const text = note.trim();
		try {
			const response = await fetch('/api/notes', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(
					text ? { action: 'save', text } : { action: 'delete', id: QUICK_NOTE_ID }
				)
			});
			noteStatus = response.ok ? 'saved' : 'error';
		} catch {
			noteStatus = 'error';
		}
	}

	async function updateHub(payload: unknown): Promise<void> {
		const response = await fetch('/api/hub', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload)
		});
		if (!response.ok) return;
		await invalidateAll();
	}

	function reorderQuickAccess(ids: string[]): void {
		void updateHub({ action: 'update-settings', settings: { quickAccessOrder: ids } });
	}

	function unpinQuickAccess(kind: 'item' | 'group', id: string): void {
		void updateHub(
			kind === 'item'
				? { action: 'update-item', id, patch: { pinned: false } }
				: { action: 'update-group', id, groupPatch: { pinned: false } }
		);
	}

	function unreadFor(sourceId: string): number {
		return data.feed.items.filter((item) => item.sourceId === sourceId && !data.state.read[item.id])
			.length;
	}

	function countForFilter(filter: SavedFilter): number {
		return entries.filter((entry) =>
			matchesFilter(
				`${entry.item.title}\n${entry.item.summary}`,
				filter.include,
				filter.exclude,
				filter.matchMode
			)
		).length;
	}
</script>

<svelte:head>
	<title>Início · Meu Hub</title>
</svelte:head>

<h1 class="sr-only">Início</h1>

<TopBar
	title="Início"
	showEdit={false}
	action="Adicionar"
	actionTitle="Adicionar item ao hub"
	actionHref={`${resolve('/gerenciar')}?tab=itens&add=link`}
/>

<div class="home-columns" data-layout={layout}>
	<div class="home-main">
		<HomeStatus {hub} feed={data.feed} hubState={data.state} />
		{#if layout === 'split'}
			<div class="home-split">
				<div class="home-split-side">
					<section class="panel dashboard-card" aria-labelledby="d-rapido">
						<QuickAccess
							{hub}
							title="Acesso rápido"
							grid
							limit={DEFAULT_QUICK_ACCESS_LIMIT}
							onreorder={reorderQuickAccess}
							onunpin={unpinQuickAccess}
						/>
						<span class="sr-only" id="d-rapido">Acesso rápido</span>
					</section>
					<section class="panel dashboard-card" aria-labelledby="d-acoes">
						<h2 id="d-acoes" class="dashboard-title">Ferramentas</h2>
						<HomeTools />
					</section>
				</div>
				<FeedBoard
					{entries}
					title="Últimas notícias"
					overview
					initialUnreadOnly
					emptyFilteredTitle="Tudo lido por aqui"
					emptyFilteredHint="Nenhum post não lido. Abra o feed completo para ver o histórico."
				/>
			</div>
		{:else}
			<div class="home-top">
				<section class="panel dashboard-card" aria-labelledby="d-rapido">
					<QuickAccess
						{hub}
						title="Acesso rápido"
						grid
						limit={DEFAULT_QUICK_ACCESS_LIMIT}
						onreorder={reorderQuickAccess}
						onunpin={unpinQuickAccess}
					/>
					<span class="sr-only" id="d-rapido">Acesso rápido</span>
				</section>
				<section class="panel dashboard-card" aria-labelledby="d-acoes">
					<h2 id="d-acoes" class="dashboard-title">Ferramentas</h2>
					<HomeTools />
				</section>
			</div>
			<FeedBoard
				{entries}
				title="Últimas notícias"
				overview
				initialUnreadOnly
				emptyFilteredTitle="Tudo lido por aqui"
				emptyFilteredHint="Nenhum post não lido. Abra o feed completo para ver o histórico."
			/>
		{/if}
	</div>

	<aside class="home-aside" aria-label="Painel lateral">
		<section class="panel section" aria-labelledby="t-fontes">
			<h2 id="t-fontes" class="fs-15">Fontes do feed</h2>
			{#each sources as source (source.id)}
				<a class="source-row" href={`${resolve('/feed')}?fonte=${source.id}`}>
					<span
						class="dot"
						style="background: {colors[source.categoryId] ?? '#8AA4FF'}; border-radius: 50%"
					></span>
					<span class="soft">{source.name}</span>
					<span class="count" title="Posts não lidos">{unreadFor(source.id)}</span>
				</a>
			{/each}
			{#if sources.length === 0}
				<p class="muted small">Nenhuma fonte ativa no hub.json.</p>
			{/if}
			<a class="chip link" href={resolve('/gerenciar')}>Ver fontes</a>
		</section>

		<section class="panel section" aria-labelledby="t-filtros">
			<div class="section-head">
				<h2 id="t-filtros" class="fs-15">Filtros salvos</h2>
				<a class="muted small" href={resolve('/feed')}>Ver feed</a>
			</div>
			<div class="chips">
				{#each hub.savedFilters as filter (filter.id)}
					<a class="chip" href={resolve('/feed') + '?filtro=' + filter.id}>
						{filter.label} · {countForFilter(filter)}
					</a>
				{/each}
				{#if hub.savedFilters.length === 0}
					<span class="muted small">Nenhum filtro salvo.</span>
				{/if}
			</div>
		</section>

		<section class="panel section" aria-labelledby="t-salvos">
			<div class="section-head">
				<h2 id="t-salvos" class="fs-15">Salvos recentemente</h2>
				<a class="muted small" href={resolve('/favoritos')}>Ver todos</a>
			</div>
			{#each savedRecent as entry (entry.item.id)}
				<a
					class="source-row"
					href={entry.item.url}
					target="_blank"
					rel="noopener noreferrer"
					title={entry.item.title}
				>
					<span
						class="dot"
						style="background: {entry.category?.color ?? '#8AA4FF'}; border-radius: 50%"
					></span>
					<span class="soft row-title">
						{entry.item.title}
					</span>
					<span class="count">{relativeTime(entry.item.publishedAt)}</span>
				</a>
			{/each}
			{#if savedRecent.length === 0}
				<span class="muted small">Nenhum post salvo ainda.</span>
			{/if}
		</section>

		<section class="panel section" aria-labelledby="t-nota">
			<h2 id="t-nota" class="fs-15">Nota rápida</h2>
			<label class="sr-only" for="nota">Nota rápida</label>
			<textarea
				id="nota"
				class="note-area"
				rows="6"
				maxlength={4000}
				placeholder="Anote algo e siga o dia..."
				bind:value={note}
				oninput={onNoteInput}></textarea>
			<span class="muted small">
				{noteStatus === 'saving'
					? 'Salvando...'
					: noteStatus === 'saved'
						? 'Salvo no hub (data/notes.json).'
						: noteStatus === 'error'
							? 'Falha ao salvar a nota.'
							: 'Salva no hub, entra no export.'}
				{#if note.length > 3600}
					· {note.length}/4000
				{/if}
			</span>
		</section>
	</aside>
</div>
