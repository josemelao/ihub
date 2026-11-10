<script lang="ts">
	import { relativeTime, tint } from '#lib/display';
	import { splitHighlights } from '#lib/feed/filter';
	import { youtubeVideoId } from '#lib/feed/youtube';
	import type { FeedViewItem } from '#lib/feed/view';
	import Icon from './Icon.svelte';
	import VideoPlayerDialog from './VideoPlayerDialog.svelte';

	let {
		entry,
		terms = [],
		variant = 'bento',
		onread,
		onsave
	}: {
		entry: FeedViewItem;
		terms?: string[];
		variant?: 'bento' | 'compact' | 'completo';
		onread: () => void;
		onsave: () => void;
	} = $props();

	const color = $derived(entry.category?.color ?? '#8AA4FF');
	const videoId = $derived(youtubeVideoId(entry.item.url, entry.item.thumbnail));
	let imageFailed = $state(false);
	let naturalAspect = $state<number | null>(null);
	let expanded = $state(false);
	let playerOpen = $state(false);
	let summaryEl = $state<HTMLElement | null>(null);
	let overflowing = $state(false);
	const hasImage = $derived(Boolean(entry.item.thumbnail) && !imageFailed);
	const canExpand = $derived(variant === 'completo' && (overflowing || expanded));

	$effect(() => {
		if (!summaryEl || variant !== 'completo') {
			overflowing = false;
			return;
		}

		const measure = () => {
			if (!summaryEl || expanded) return;
			const next = summaryEl.scrollHeight > summaryEl.clientHeight + 1;
			if (next !== overflowing) overflowing = next;
		};

		const frame = requestAnimationFrame(measure);
		if (typeof ResizeObserver === 'undefined') {
			return () => cancelAnimationFrame(frame);
		}

		const observer = new ResizeObserver(measure);
		observer.observe(summaryEl);
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	});

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

{#if variant === 'compact'}
	<article class="feed-card variant-compact" class:read={entry.read}>
		{#if videoId}
			<button
				class="feed-thumb feed-thumb-button"
				class:compact-placeholder={!hasImage}
				type="button"
				aria-label={`Reproduzir: ${entry.item.title}`}
				style={thumbStyle}
				onclick={() => (playerOpen = true)}
			>
				{#if hasImage}
					<img
						src={entry.item.thumbnail ?? ''}
						alt=""
						loading="lazy"
						onload={onImageLoad}
						onerror={() => (imageFailed = true)}
					/>
				{:else}
					<span>{entry.source.name}</span>
				{/if}
				<span class="feed-play" aria-hidden="true"><Icon name="play" size={20} /></span>
			</button>
		{:else if hasImage}
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
		{:else}
			<span class="feed-thumb compact-placeholder" style={thumbStyle}>
				<span>{entry.source.name}</span>
			</span>
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

			<h3 class="feed-title compact-title">
				<a href={entry.item.url} target="_blank" rel="noopener noreferrer">
					{#each splitHighlights(entry.item.title, terms) as segment, index (index)}
						{#if segment.highlight}
							<mark>{segment.text}</mark>
						{:else}
							{segment.text}
						{/if}
					{/each}
				</a>
			</h3>

			<div class="feed-actions">
				<a
					class="icon-action"
					href={entry.item.url}
					target="_blank"
					rel="noopener noreferrer"
					aria-label="Abrir"
					title="Abrir"
				>
					<Icon name="external" size={18} />
				</a>
				<button
					class="icon-action"
					class:saved={entry.saved}
					type="button"
					aria-pressed={entry.saved}
					aria-label={entry.saved ? 'Remover dos salvos' : 'Salvar para depois'}
					title={entry.saved ? 'Remover dos salvos' : 'Salvar para depois'}
					onclick={onsave}
				>
					<Icon name="bookmark" size={18} />
				</button>
				<button
					class="icon-action"
					class:read={entry.read}
					type="button"
					aria-pressed={entry.read}
					aria-label={entry.read ? 'Marcar como não lido' : 'Marcar como lido'}
					title={entry.read ? 'Marcar como não lido' : 'Marcar como lido'}
					onclick={onread}
				>
					<Icon name={entry.read ? 'check-circle' : 'circle'} size={18} />
				</button>
			</div>
		</div>
	</article>
{:else}
	<article class="feed-card variant-{variant}" class:no-image={!hasImage} class:read={entry.read}>
		{#if videoId}
			<button
				class="feed-thumb feed-thumb-button"
				type="button"
				aria-label={`Reproduzir: ${entry.item.title}`}
				style={thumbStyle}
				onclick={() => (playerOpen = true)}
			>
				{#if hasImage}
					<img
						src={entry.item.thumbnail ?? ''}
						alt=""
						loading="lazy"
						onload={onImageLoad}
						onerror={() => (imageFailed = true)}
					/>
				{:else}
					<span class="feed-thumb-fallback">{entry.source.name}</span>
				{/if}
				<span class="feed-play" aria-hidden="true"><Icon name="play" size={22} /></span>
			</button>
		{:else if hasImage}
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
				<p
					bind:this={summaryEl}
					class="feed-summary"
					class:clamped={variant === 'completo' && !expanded}
				>
					{entry.item.summary}
				</p>
				{#if canExpand}
					<button
						class="expand-btn"
						type="button"
						aria-expanded={expanded}
						onclick={() => (expanded = !expanded)}
					>
						{expanded ? 'Recolher' : 'Expandir'}
					</button>
				{/if}
			{/if}

			<div class="feed-actions">
				<a
					class="icon-action"
					href={entry.item.url}
					target="_blank"
					rel="noopener noreferrer"
					aria-label="Abrir"
					title="Abrir"
				>
					<Icon name="external" size={18} />
				</a>
				<button
					class="icon-action"
					class:saved={entry.saved}
					type="button"
					aria-pressed={entry.saved}
					aria-label={entry.saved ? 'Remover dos salvos' : 'Salvar para depois'}
					title={entry.saved ? 'Remover dos salvos' : 'Salvar para depois'}
					onclick={onsave}
				>
					<Icon name="bookmark" size={18} />
				</button>
				<button
					class="icon-action"
					class:read={entry.read}
					type="button"
					aria-pressed={entry.read}
					aria-label={entry.read ? 'Marcar como não lido' : 'Marcar como lido'}
					title={entry.read ? 'Marcar como não lido' : 'Marcar como lido'}
					onclick={onread}
				>
					<Icon name={entry.read ? 'check-circle' : 'circle'} size={18} />
				</button>
			</div>
		</div>
	</article>
{/if}

{#if playerOpen && videoId}
	<VideoPlayerDialog {videoId} title={entry.item.title} onclose={() => (playerOpen = false)} />
{/if}
