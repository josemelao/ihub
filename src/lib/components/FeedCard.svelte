<script lang="ts">
	import { relativeTime, tint } from '#lib/display';
	import { splitHighlights } from '#lib/feed/filter';
	import type { FeedViewItem } from '#lib/feed/view';

	let {
		entry,
		terms = [],
		variant = 'bento',
		onread,
		onsave
	}: {
		entry: FeedViewItem;
		terms?: string[];
		variant?: 'bento' | 'compact' | 'grid';
		onread: () => void;
		onsave: () => void;
	} = $props();

	const color = $derived(entry.category?.color ?? '#8AA4FF');
	let imageFailed = $state(false);
	let naturalAspect = $state<number | null>(null);
	const hasImage = $derived(Boolean(entry.item.thumbnail) && !imageFailed);

	const thumbAspect = $derived.by(() => {
		if (!naturalAspect) return 1.5;
		return Math.min(1.6, Math.max(0.7, naturalAspect));
	});
	const thumbStyle = $derived(
		`background: ${tint(color, 0.14)}; color: ${color};` +
			(variant === 'bento' ? ` aspect-ratio: ${thumbAspect};` : '')
	);

	function onImageLoad(event: Event): void {
		const image = event.currentTarget as HTMLImageElement;
		if (image.naturalWidth > 0 && image.naturalHeight > 0) {
			naturalAspect = image.naturalWidth / image.naturalHeight;
		}
	}
</script>

<article class="feed-card variant-{variant}" class:no-image={!hasImage} class:read={entry.read}>
	{#if hasImage}
		<a
			class="feed-thumb"
			href={entry.item.url}
			target="_blank"
			rel="noopener noreferrer"
			aria-label={`Abrir: ${entry.item.title}`}
			style={thumbStyle}
		>
			<img
				src={entry.item.thumbnail ?? ''}
				alt=""
				loading="lazy"
				onload={onImageLoad}
				onerror={() => (imageFailed = true)}
			/>
		</a>
	{/if}

	<div class="feed-body">
		<div class="feed-meta">
			<span class="feed-source" style="color: {color}">
				<span class="dot" style="background: {color}; border-radius: 50%"></span>
				{entry.source.name}
			</span>
			<span>·</span>
			<span>{relativeTime(entry.item.publishedAt)}</span>
			{#if entry.category}
				<span class="tag">{entry.category.name}</span>
			{/if}
			{#if entry.read}
				<span class="tag muted">lido</span>
			{/if}
			{#if entry.saved}
				<span class="tag">salvo</span>
			{/if}
		</div>

		<h3 class="feed-title">
			{#each splitHighlights(entry.item.title, terms) as segment, index (index)}
				{#if segment.highlight}
					<mark>{segment.text}</mark>
				{:else}
					{segment.text}
				{/if}
			{/each}
		</h3>

		{#if entry.item.summary}
			<p class="feed-summary">{entry.item.summary}</p>
		{/if}

		<div class="feed-actions">
			<a href={entry.item.url} target="_blank" rel="noopener noreferrer">Abrir</a>
			<button type="button" onclick={onsave}>
				{entry.saved ? 'Remover dos salvos' : 'Salvar para depois'}
			</button>
			<button type="button" onclick={onread}>
				{entry.read ? 'Marcar como não lido' : 'Marcar como lido'}
			</button>
		</div>
	</div>
</article>
