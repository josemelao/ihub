<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
	import { HIGHLIGHT_COLORS, HIGHLIGHT_COLOR_LABELS } from '#lib/reader/highlight-meta';
	import {
		countByColor,
		filterHighlights,
		totalHighlights,
		type HighlightColorFilter
	} from '#lib/reader/highlights-view';
	import type { ReadingHighlight } from '#lib/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let query = $state('');
	let colorFilter = $state<HighlightColorFilter>('all');
	let removing = $state<ReadingHighlight | null>(null);
	let removeError = $state('');

	async function confirmRemove(): Promise<void> {
		if (!removing) return;
		const id = removing.id;
		removing = null;
		removeError = '';

		try {
			const response = await fetch('/api/highlights', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action: 'delete', id })
			});
			const body = (await response.json()) as { ok?: boolean; error?: string };

			if (!response.ok || !body.ok) {
				removeError = body.error ?? 'Não foi possível remover o destaque.';
				return;
			}
			await invalidateAll();
		} catch {
			removeError = 'Falha de rede ao remover o destaque.';
		}
	}

	const total = $derived(totalHighlights(data.groups));
	const queryGroups = $derived(filterHighlights(data.groups, { query }));
	const colorCounts = $derived(countByColor(queryGroups.flatMap((group) => group.highlights)));
	const groups = $derived(filterHighlights(queryGroups, { color: colorFilter }));
	const visible = $derived(totalHighlights(groups));
	const filtering = $derived(Boolean(query.trim()) || colorFilter !== 'all');
	const emptyMessage = $derived.by(() => {
		if (data.groups.length === 0) return 'Nenhum destaque ainda.';
		const color = colorFilter !== 'all' ? HIGHLIGHT_COLOR_LABELS[colorFilter] : '';
		const term = query.trim();
		if (term && color) return `Nenhum destaque ${color} com “${term}”.`;
		if (term) return 'Nenhum destaque para esta busca.';
		return `Nenhum destaque ${color}.`;
	});
</script>

<svelte:head>
	<title>Destaques · Meu Hub</title>
</svelte:head>

<TopBar placeholder="Buscar destaques" />

<div class="section-head">
	<h1>Destaques</h1>
	<span class="muted small">
		{#if filtering}{visible} de {total}{:else}{total}{/if}
		{total === 1 ? 'trecho marcado' : 'trechos marcados'}
	</span>
</div>

<div class="filter-panel highlights-filter">
	<div class="filter-row">
		<div class="filter-input">
			<Icon name="search" size={16} />
			<label class="sr-only" for="hl-search">Buscar destaques</label>
			<input
				id="hl-search"
				type="search"
				bind:value={query}
				placeholder="Buscar trecho, nota ou título"
			/>
		</div>
		{#if filtering}
			<span class="muted small filter-count" aria-live="polite">
				{visible} de {total} trechos
			</span>
		{/if}
	</div>
	<div class="chips" role="group" aria-label="Filtrar por cor">
		<button
			class="chip"
			class:solid={colorFilter === 'all'}
			type="button"
			aria-pressed={colorFilter === 'all'}
			onclick={() => (colorFilter = 'all')}
		>
			Todas · {colorCounts.all}
		</button>
		{#each HIGHLIGHT_COLORS as color (color)}
			<button
				class="chip"
				class:active={colorFilter === color}
				type="button"
				aria-pressed={colorFilter === color}
				onclick={() => (colorFilter = color)}
			>
				<span class="color-dot hl-{color}" aria-hidden="true"></span>
				{HIGHLIGHT_COLOR_LABELS[color]}{#if colorCounts[color]}
					· {colorCounts[color]}{/if}
			</button>
		{/each}
	</div>
</div>

{#if removeError}
	<div class="alert section" role="status">{removeError}</div>
{/if}

{#if removing}
	<ConfirmDialog
		title="Remover destaque"
		message={`Remover o destaque “${removing.quote.slice(0, 80)}”?`}
		onconfirm={confirmRemove}
		oncancel={() => (removing = null)}
	/>
{/if}

{#if groups.length === 0}
	<p class="muted section">{emptyMessage}</p>
{:else}
	{#each groups as group (group.itemId)}
		<section class="panel section" aria-labelledby={`t-hl-${group.itemId}`}>
			<div class="hl-head">
				<h2 id={`t-hl-${group.itemId}`} class="fs-15">
					<a href={resolve('/ler/[id]', { id: group.itemId })}>{group.itemTitle}</a>
				</h2>
				<a
					class="chip link"
					href={group.itemUrl}
					target="_blank"
					rel="noopener noreferrer"
					aria-label="Abrir original de {group.itemTitle}"
				>
					<Icon name="external" size={14} />
					Abrir original
				</a>
			</div>

			<ul class="highlight-list">
				{#each group.highlights as highlight (highlight.id)}
					<li>
						<div class="hl-head">
							<span class="tag hl-{highlight.color}">
								{HIGHLIGHT_COLOR_LABELS[highlight.color]}
							</span>
							<button
								type="button"
								class="chip"
								aria-label="Remover destaque {highlight.quote.slice(0, 40)}"
								onclick={() => (removing = highlight)}
							>
								Remover
							</button>
						</div>
						<blockquote>{highlight.quote}</blockquote>
						{#if highlight.note}
							<p class="muted small">{highlight.note}</p>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/each}
{/if}
