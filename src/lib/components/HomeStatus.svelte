<script lang="ts">
	import { resolve } from '$app/paths';
	import { relativeTime } from '#lib/display';
	import type { FeedCache, HubData, HubState } from '#lib/types';

	let { hub, feed, hubState }: { hub: HubData; feed: FeedCache; hubState: HubState } = $props();

	const unread = $derived(feed.items.filter((item) => !hubState.read[item.id]).length);
	const errors = $derived(
		hub.feedSources.filter((source) => source.enabled && Boolean(feed.sources[source.id]?.error))
	);
	// 429 não é defeito: a fonte tem conteúdo, só está esperando o site liberar.
	const rateLimited = $derived(
		errors.filter((source) => /429/.test(feed.sources[source.id]?.error ?? ''))
	);
	const failed = $derived(
		errors.filter((source) => !/429/.test(feed.sources[source.id]?.error ?? ''))
	);
	const failedNames = $derived(failed.map((source) => source.name).join(', '));
	const waitingNames = $derived(rateLimited.map((source) => source.name).join(', '));
	const updated = $derived(
		feed.items.length > 0 ? relativeTime(feed.updatedAt) : 'nunca atualizado'
	);
</script>

<div class="home-status">
	<a class="home-status-unread" href={resolve('/feed') + '?nao-lidos=1'}>
		<strong>{unread}</strong>
		{unread === 1 ? 'não lido' : 'não lidos'}
	</a>
	<span class="home-status-sep" aria-hidden="true">·</span>
	<span class="muted small">atualizado {updated}</span>
	{#if rateLimited.length > 0}
		<span class="muted small" title={waitingNames}>
			{rateLimited.length}
			{rateLimited.length === 1 ? 'fonte' : 'fontes'} aguardando limite do site
		</span>
	{/if}
	{#if failed.length > 0}
		<a
			class="home-status-error"
			href={resolve('/gerenciar') + '?tab=fontes&status=erro'}
			title={failedNames}
		>
			{failed.length}
			{failed.length === 1 ? 'fonte com erro' : 'fontes com erro'}
		</a>
	{/if}
</div>
