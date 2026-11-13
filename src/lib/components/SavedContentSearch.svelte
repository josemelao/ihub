<script lang="ts">
	import { resolve } from '$app/paths';
	import { splitHighlights } from '#lib/feed/filter';
	import type {
		ContentSearchResult,
		ContentSnippet,
		ContentSort
	} from '#lib/reader/content-search';

	let {
		query,
		savedCount,
		sort = 'saved'
	}: { query: string; savedCount: number; sort?: ContentSort } = $props();

	const terms = $derived(query.trim().split(/\s+/).filter(Boolean));

	function segments(snippet: ContentSnippet) {
		return splitHighlights(`${snippet.before}${snippet.match}${snippet.after}`, terms);
	}

	const PAGE = 50;
	let limit = $state(PAGE);
	let results = $state<ContentSearchResult | null>(null);
	let loading = $state(false);
	let error = $state('');
	let controller: AbortController | null = null;
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function run(
		term: string,
		requested: number,
		order: ContentSort,
		ctrl: AbortController
	): Promise<void> {
		try {
			const response = await fetch(
				`/api/search/content?q=${encodeURIComponent(term)}&limit=${requested}&sort=${order}`,
				{ signal: ctrl.signal }
			);
			if (!response.ok) {
				const body = (await response.json().catch(() => ({}))) as { error?: string };
				throw new Error(body.error ?? 'Falha ao buscar no conteúdo.');
			}
			results = (await response.json()) as ContentSearchResult;
		} catch (cause) {
			if (ctrl.signal.aborted) return;
			error = cause instanceof Error ? cause.message : 'Falha ao buscar no conteúdo.';
		} finally {
			if (!ctrl.signal.aborted) loading = false;
		}
	}

	$effect(() => {
		const term = query.trim();
		const requested = limit;
		const order = sort;
		clearTimeout(timer);
		controller?.abort();

		if (term.length < 2) {
			results = null;
			error = '';
			loading = false;
			return;
		}

		loading = true;
		error = '';
		timer = setTimeout(() => {
			controller = new AbortController();
			void run(term, requested, order, controller);
		}, 250);

		return () => {
			clearTimeout(timer);
			controller?.abort();
		};
	});

	function mostrarMais(): void {
		limit += 20;
	}
</script>

{#if query.trim().length < 2}
	<p class="content-empty">Digite ao menos 2 caracteres para buscar no texto dos salvos.</p>
{:else if error}
	<p class="content-empty" role="alert">{error}</p>
{:else if loading && !results}
	<p class="content-empty" aria-live="polite">Buscando…</p>
{:else if results}
	<div class="content-search">
		<p class="content-summary" aria-live="polite">
			<span>
				{results.total}
				{results.total === 1 ? 'resultado' : 'resultados'}
				em {results.coverage.savedWithText} de {results.coverage.saved}
				{results.coverage.saved === 1 ? 'salvo' : 'salvos'} com texto
			</span>
			<span>texto = trecho · ▸ = destaque</span>
		</p>

		{#if results.total === 0}
			<p class="content-empty">
				{#if results.coverage.savedWithText === 0}
					Nenhum salvo tem texto completo ainda. Abra um post em <strong>Ler</strong> para extrair o conteúdo.
				{:else}
					Nenhum trecho com “{results.query}” em {results.coverage.savedWithText} salvos com texto.
				{/if}
			</p>
		{:else}
			<ul class="content-results">
				{#each results.groups as group (group.itemId)}
					<li class="content-group">
						<div class="content-head">
							<a class="content-title" href={resolve('/ler/[id]', { id: group.itemId })}>
								{group.title}
							</a>
							<span class="content-meta">{group.sourceName}</span>
						</div>
						{#each group.matches as match, index (match.highlightId ?? `texto-${index}`)}
							<p class="content-match">
								{#if match.kind === 'highlight'}
									<span class="content-flag hl-{match.color}" aria-hidden="true">▸</span>
								{/if}
								<span class="content-snippet">
									{#each segments(match.snippet) as segment, segmentIndex (segmentIndex)}
										{#if segment.highlight}<mark>{segment.text}</mark>{:else}{segment.text}{/if}
									{/each}
								</span>
								<span class="content-kind">{match.kind === 'text' ? 'texto' : 'destaque'}</span>
							</p>
						{/each}
					</li>
				{/each}
			</ul>
		{/if}

		{#if results.outside.length > 0}
			<h3 class="content-divider">Destaques fora dos salvos</h3>
			<ul class="content-results">
				{#each results.outside as group (group.itemId)}
					<li class="content-group">
						<div class="content-head">
							<a class="content-title" href={group.url} target="_blank" rel="noopener noreferrer">
								{group.title}
							</a>
							<span class="content-meta">não salvo</span>
						</div>
						{#each group.matches as match, index (match.highlightId ?? `fora-${index}`)}
							<p class="content-match">
								<span class="content-flag hl-{match.color}" aria-hidden="true">▸</span>
								<span class="content-snippet">
									{#each segments(match.snippet) as segment, segmentIndex (segmentIndex)}
										{#if segment.highlight}<mark>{segment.text}</mark>{:else}{segment.text}{/if}
									{/each}
								</span>
								<span class="content-kind">destaque</span>
							</p>
						{/each}
					</li>
				{/each}
			</ul>
		{/if}

		{#if results.hasMore}
			<button class="chip content-more" type="button" onclick={mostrarMais}> Mostrar mais </button>
		{/if}
	</div>
{:else if savedCount === 0}
	<p class="content-empty">Nenhum post salvo ainda.</p>
{/if}
