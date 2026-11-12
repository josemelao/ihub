<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import Icon from '#lib/components/Icon.svelte';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import HighlightDialog from '#lib/components/HighlightDialog.svelte';
	import HighlightToolbar from '#lib/components/HighlightToolbar.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
	import { HIGHLIGHT_COLOR_LABELS } from '#lib/reader/highlights';
	import { buildSelectionInfo } from '#lib/reader/selection';
	import type { HighlightColor, ReadingArticle, ReadingHighlight } from '#lib/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let article = $state<ReadingArticle | null>(untrack(() => data.article));
	let fullText = $state(untrack(() => data.source?.fullText ?? false));
	let highlights = $state(untrack(() => data.highlights));
	let busy = $state(false);
	let errorMessage = $state('');
	let highlightError = $state('');
	let articleEl = $state<HTMLElement | null>(null);
	let removing = $state<ReadingHighlight | null>(null);
	let toolbar = $state<{ quote: string; occurrence: number; x: number; y: number } | null>(null);
	let dialog = $state<{
		id?: string;
		quote: string;
		occurrence: number;
		color: HighlightColor;
		note: string;
	} | null>(null);

	const minutes = $derived(article ? Math.max(1, Math.round(article.length / 1000)) : 0);
	const canActivate = $derived(Boolean(data.source && data.source.type === 'rss' && !fullText));

	onMount(() => {
		if (!article && data.source?.type === 'rss' && fullText) void extract();
	});

	$effect(() => {
		if (!articleEl) return;

		const handler = () => onSelection();
		document.addEventListener('mouseup', handler);
		document.addEventListener('keyup', handler);
		return () => {
			document.removeEventListener('mouseup', handler);
			document.removeEventListener('keyup', handler);
		};
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

	function onSelection(): void {
		if (!article || !articleEl) return;
		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
			toolbar = null;
			return;
		}

		const range = selection.getRangeAt(0);
		if (!articleEl.contains(range.commonAncestorContainer)) {
			toolbar = null;
			return;
		}

		const before = document.createRange();
		before.selectNodeContents(articleEl);
		before.setEnd(range.startContainer, range.startOffset);
		const domText = (articleEl.textContent ?? '').replace(/\s+/g, ' ');
		const beforeText = before.toString().replace(/\s+/g, ' ');
		const info = buildSelectionInfo(selection.toString(), domText, beforeText.length);
		if (!info) {
			toolbar = null;
			return;
		}

		const rect = range.getBoundingClientRect();
		toolbar = {
			...info,
			x: Math.round(rect.left + rect.width / 2),
			y: Math.round(rect.top)
		};
	}

	function pickColor(color: HighlightColor): void {
		if (!toolbar) return;
		const current = { ...toolbar };
		void saveHighlight({
			quote: current.quote,
			occurrence: current.occurrence,
			color,
			note: ''
		});
	}

	function annotateSelection(): void {
		if (!toolbar) return;
		dialog = {
			quote: toolbar.quote,
			occurrence: toolbar.occurrence,
			color: 'yellow',
			note: ''
		};
		toolbar = null;
	}

	function editHighlight(highlight: ReadingHighlight): void {
		dialog = {
			id: highlight.id,
			quote: highlight.quote,
			occurrence: highlight.occurrence,
			color: highlight.color,
			note: highlight.note ?? ''
		};
	}

	function saveDialog(value: { color: HighlightColor; note: string }): void {
		if (!dialog) return;
		void saveHighlight({ ...dialog, ...value });
	}

	async function saveHighlight(input: {
		id?: string;
		quote: string;
		occurrence: number;
		color: HighlightColor;
		note: string;
	}): Promise<void> {
		highlightError = '';
		const payload = input.id
			? { action: 'update', id: input.id, note: input.note, color: input.color }
			: {
					action: 'save',
					itemId: data.item.id,
					quote: input.quote,
					note: input.note,
					color: input.color,
					occurrence: input.occurrence
				};

		try {
			const response = await fetch('/api/highlights', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const body = (await response.json()) as {
				ok?: boolean;
				error?: string;
				highlights?: { highlights: ReadingHighlight[] };
			};

			if (!response.ok || !body.ok) {
				highlightError = body.error ?? 'Não foi possível salvar o destaque.';
				return;
			}
			highlights = (body.highlights?.highlights ?? []).filter(
				(highlight) => highlight.itemId === data.item.id
			);
			toolbar = null;
			dialog = null;
			window.getSelection()?.removeAllRanges();
		} catch {
			highlightError = 'Falha de rede ao salvar o destaque.';
		}
	}

	async function deleteHighlight(id: string): Promise<void> {
		highlightError = '';
		try {
			const response = await fetch('/api/highlights', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action: 'delete', id })
			});
			const body = (await response.json()) as {
				ok?: boolean;
				error?: string;
				highlights?: { highlights: ReadingHighlight[] };
			};

			if (!response.ok || !body.ok) {
				highlightError = body.error ?? 'Não foi possível remover o destaque.';
				return;
			}
			highlights = (body.highlights?.highlights ?? []).filter(
				(highlight) => highlight.itemId === data.item.id
			);
		} catch {
			highlightError = 'Falha de rede ao remover o destaque.';
		}
	}

	function confirmRemove(): void {
		if (!removing) return;
		const id = removing.id;
		removing = null;
		void deleteHighlight(id);
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
		<article class="reader-body" bind:this={articleEl}>
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

	{#if toolbar}
		<HighlightToolbar
			x={toolbar.x}
			y={toolbar.y}
			onpick={pickColor}
			onannotate={annotateSelection}
			onclose={() => (toolbar = null)}
		/>
	{/if}

	{#if dialog}
		<HighlightDialog
			quote={dialog.quote}
			initialColor={dialog.color}
			initialNote={dialog.note}
			onsave={saveDialog}
			onclose={() => (dialog = null)}
		/>
	{/if}

	{#if highlightError}
		<div class="alert reader-status" role="status">{highlightError}</div>
	{/if}

	{#if removing}
		<ConfirmDialog
			title="Remover destaque"
			message={`Remover o destaque “${removing.quote.slice(0, 80)}”?`}
			onconfirm={confirmRemove}
			oncancel={() => (removing = null)}
		/>
	{/if}

	{#if highlights.length > 0}
		<section class="reader-highlights panel" aria-labelledby="t-reader-highlights">
			<h2 id="t-reader-highlights">Seus destaques</h2>
			<ul>
				{#each highlights as highlight (highlight.id)}
					<li>
						<div class="hl-head">
							<span class="tag hl-{highlight.color}">
								{HIGHLIGHT_COLOR_LABELS[highlight.color]}
							</span>
							<button
								type="button"
								class="chip"
								aria-label="Editar destaque {highlight.quote.slice(0, 40)}"
								onclick={() => editHighlight(highlight)}
							>
								Editar
							</button>
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
	{/if}
</div>
