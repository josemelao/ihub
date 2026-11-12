<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import Icon from '#lib/components/Icon.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
	import type { ReadingArticle } from '#lib/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let article = $state<ReadingArticle | null>(untrack(() => data.article));
	let fullText = $state(untrack(() => data.source?.fullText ?? false));
	let highlights = $state(untrack(() => data.highlights));
	let busy = $state(false);
	let errorMessage = $state('');

	const minutes = $derived(article ? Math.max(1, Math.round(article.length / 1000)) : 0);
	const canActivate = $derived(Boolean(data.source && data.source.type === 'rss' && !fullText));

	onMount(() => {
		if (!article && data.source?.type === 'rss' && fullText) void extract();
	});

	async function extract(): Promise<void> {
		if (busy) return;
		busy = true;
		errorMessage = '';

		try {
			const response = await fetch('/api/reader', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ itemId: data.item.id })
			});
			const body = (await response.json()) as {
				ok?: boolean;
				article?: ReadingArticle;
				error?: string;
			};

			if (!response.ok || !body.article) {
				errorMessage = body.error ?? 'Não foi possível extrair o texto completo.';
				return;
			}
			article = body.article;
		} catch {
			errorMessage = 'Falha de rede ao extrair o texto.';
		} finally {
			busy = false;
		}
	}

	async function activate(): Promise<void> {
		if (!data.source || busy) return;
		busy = true;
		errorMessage = '';

		try {
			const response = await fetch('/api/hub', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					action: 'update-source',
					id: data.source.id,
					sourcePatch: { fullText: true }
				})
			});
			const body = (await response.json()) as { ok?: boolean; error?: string };

			if (!response.ok || !body.ok) {
				errorMessage = body.error ?? 'Não foi possível ativar o texto completo.';
				return;
			}
			fullText = true;
		} catch {
			errorMessage = 'Falha de rede ao ativar o texto completo.';
			return;
		} finally {
			busy = false;
		}

		await extract();
	}
</script>

<svelte:head>
	<title>{data.item.title} · Meu Hub</title>
</svelte:head>

<TopBar placeholder="Buscar no hub" />

<div class="reader-page">
	<a class="soft small reader-back" href={resolve('/feed')}>
		<Icon name="arrow-left" size={16} />
		Voltar ao feed
	</a>

	<header class="reader-head">
		<h1>{data.item.title}</h1>
		<p class="muted small">
			{#if data.source}
				{data.source.name}
			{/if}
			{#if article?.siteName}
				· {article.siteName}
			{/if}
			{#if article?.byline}
				· {article.byline}
			{/if}
			{#if article}
				· ~{minutes} min
			{/if}
		</p>

		<div class="reader-actions">
			<a
				class="chip link"
				href={data.item.url}
				target="_blank"
				rel="noopener noreferrer"
				aria-label="Abrir original"
			>
				<Icon name="external" size={16} />
				Abrir original
			</a>
			{#if canActivate}
				<button type="button" class="chip" onclick={activate} disabled={busy}>
					Ativar texto completo nesta fonte
				</button>
			{/if}
		</div>
	</header>

	{#if article}
		<article class="reader-body">
			<!-- article.html vem exclusivamente de sanitizeArticleHtml (allowlist). -->
			{@html article.html}
		</article>
	{:else if busy}
		<p class="muted reader-status" role="status">Buscando o texto completo…</p>
	{:else if errorMessage}
		<div class="reader-status">
			<div class="alert" role="status">{errorMessage}</div>
			<button type="button" class="chip" onclick={extract}>Tentar de novo</button>
		</div>
	{:else if data.source && data.source.type !== 'rss'}
		<p class="muted reader-status">Reader indisponível para esta fonte. Use “Abrir original”.</p>
	{:else if canActivate}
		<p class="muted reader-status">
			O texto completo está desligado para esta fonte. Ative acima para ler aqui.
		</p>
	{:else}
		<p class="reader-status muted">{data.item.summary}</p>
	{/if}

	{#if highlights.length > 0}
		<section class="reader-highlights panel" aria-labelledby="t-reader-highlights">
			<h2 id="t-reader-highlights">Seus destaques</h2>
			<ul>
				{#each highlights as highlight (highlight.id)}
					<li>
						<blockquote>{highlight.quote}</blockquote>
						{#if highlight.note}
							<p class="muted small">{highlight.note}</p>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
