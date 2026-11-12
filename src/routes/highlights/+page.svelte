<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from '#lib/components/Icon.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
	import { normalize } from '#lib/feed/filter';
	import { HIGHLIGHT_COLOR_LABELS } from '#lib/reader/highlights';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let query = $state('');

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
		{data.groups.length}
		{data.groups.length === 1 ? 'trecho marcado' : 'trechos marcados'}
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
						<span class="tag hl-{highlight.color}">
							{HIGHLIGHT_COLOR_LABELS[highlight.color]}
						</span>
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
