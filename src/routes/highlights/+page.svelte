<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
	import { normalize } from '#lib/feed/filter';
	import { HIGHLIGHT_COLOR_LABELS } from '#lib/reader/highlights';
	import { totalHighlights } from '#lib/reader/highlights-view';
	import type { ReadingHighlight } from '#lib/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let query = $state('');
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

	const terms = $derived(
		query
			.trim()
			.split(/\s+/)
			.filter(Boolean)
			.map((term) => normalize(term))
	);

	const groups = $derived(
		terms.length === 0
			? data.groups
			: data.groups.filter((group) => {
					const haystack = normalize(
						`${group.itemTitle}\n${group.highlights
							.map((highlight) => `${highlight.quote}\n${highlight.note ?? ''}`)
							.join('\n')}`
					);
					return terms.every((term) => haystack.includes(term));
				})
	);
</script>

<svelte:head>
	<title>Destaques · Meu Hub</title>
</svelte:head>

<TopBar placeholder="Buscar destaques" />

<div class="section-head">
	<h1>Destaques</h1>
	<span class="muted small">
		{total}
		{total === 1 ? 'trecho marcado' : 'trechos marcados'}
	</span>
</div>

<div class="section">
	<label class="sr-only" for="hl-search">Buscar destaques</label>
	<input
		id="hl-search"
		type="search"
		bind:value={query}
		placeholder="Buscar trecho, nota ou título"
	/>
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
	<p class="muted section">
		{query.trim() ? 'Nenhum destaque para esta busca.' : 'Nenhum destaque ainda.'}
	</p>
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
