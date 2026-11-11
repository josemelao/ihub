<script lang="ts">
	import { relativeTime, tint } from '#lib/display';
	import { splitHighlights } from '#lib/feed/filter';
	import { redditPostInfo } from '#lib/feed/reddit';
	import { youtubeVideoId } from '#lib/feed/youtube';
	import type { FeedViewItem } from '#lib/feed/view';
	import Icon from './Icon.svelte';
	import ImageLightbox from './ImageLightbox.svelte';
	import RedditPlayerDialog from './RedditPlayerDialog.svelte';
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
	const reddit = $derived(redditPostInfo(entry.item.url));
	let imageFailed = $state(false);
	let naturalAspect = $state<number | null>(null);
	let expanded = $state(false);
	let playerOpen = $state(false);
	let imageOpen = $state(false);
	let redditLoading = $state(false);
	let redditOpen = $state(false);
	let redditVideo = $state<string | null | undefined>(undefined);
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

	async function openRedditMedia(): Promise<void> {
		if (!reddit) return;

		if (redditVideo !== undefined) {
			if (redditVideo) redditOpen = true;
			else imageOpen = true;
			return;
		}

		redditLoading = true;
		try {
			const response = await fetch('/api/reddit-media', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ url: entry.item.url })
			});
			const result = (await response.json()) as {
				ok?: boolean;
				isVideo?: boolean;
				embedUrl?: string;
			};

			if (result.ok && result.isVideo && result.embedUrl) {
				redditVideo = result.embedUrl;
				redditOpen = true;
			} else {
				redditVideo = null;
				imageOpen = true;
			}
		} catch {
			redditVideo = null;
			imageOpen = true;
		} finally {
			redditLoading = false;
		}
	}
</script>

{#if entry.missing}
	<article class="feed-card missing-card">
		<h3>Conteúdo indisponível</h3>
		<p class="missing-hint">Este post salvo perdeu os dados e não pode ser aberto.</p>
		<button class="missing-remove" type="button" onclick={onsave}>Remover dos salvos</button>
	</article>
{:else if variant === 'compact'}
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
						referrerpolicy="no-referrer"
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
		{:else if reddit && hasImage}
			<button
				class="feed-thumb feed-thumb-button feed-thumb-reddit"
				class:loading={redditLoading}
				type="button"
				aria-label={`Abrir mídia do Reddit: ${entry.item.title}`}
				title="Abrir mídia do Reddit"
				style={thumbStyle}
				onclick={openRedditMedia}
				disabled={redditLoading}
			>
				<img
					referrerpolicy="no-referrer"
					src={entry.item.thumbnail ?? ''}
					alt=""
					loading="lazy"
					onload={onImageLoad}
					onerror={() => (imageFailed = true)}
				/>
				<span class="feed-reddit" aria-hidden="true">
					{#if redditLoading}
						<span class="feed-spinner"></span>
					{:else if redditVideo}
						<Icon name="play" size={12} />
					{:else if redditVideo === null}
						<Icon name="expand" size={12} />
					{:else}
						R
					{/if}
				</span>
			</button>
		{:else if hasImage}
			<button
				class="feed-thumb feed-thumb-button feed-thumb-image"
				type="button"
				aria-label={`Ver imagem: ${entry.item.title}`}
				style={thumbStyle}
				onclick={() => (imageOpen = true)}
			>
				<img
					referrerpolicy="no-referrer"
					src={entry.item.thumbnail ?? ''}
					alt=""
					loading="lazy"
					onload={onImageLoad}
					onerror={() => (imageFailed = true)}
				/>
				<span class="feed-zoom" aria-hidden="true"><Icon name="expand" size={14} /></span>
			</button>
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
						referrerpolicy="no-referrer"
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
		{:else if reddit && hasImage}
			<button
				class="feed-thumb feed-thumb-button feed-thumb-reddit"
				class:loading={redditLoading}
				type="button"
				aria-label={`Abrir mídia do Reddit: ${entry.item.title}`}
				title="Abrir mídia do Reddit"
				style={thumbStyle}
				onclick={openRedditMedia}
				disabled={redditLoading}
			>
				<img
					referrerpolicy="no-referrer"
					src={entry.item.thumbnail ?? ''}
					alt=""
					loading="lazy"
					onload={onImageLoad}
					onerror={() => (imageFailed = true)}
				/>
				<span class="feed-reddit" aria-hidden="true">
					{#if redditLoading}
						<span class="feed-spinner"></span>
					{:else if redditVideo}
						<Icon name="play" size={13} />
					{:else if redditVideo === null}
						<Icon name="expand" size={13} />
					{:else}
						R
					{/if}
				</span>
			</button>
		{:else if hasImage}
			<button
				class="feed-thumb feed-thumb-button feed-thumb-image"
				type="button"
				aria-label={`Ver imagem: ${entry.item.title}`}
				style={thumbStyle}
				onclick={() => (imageOpen = true)}
			>
				<img
					referrerpolicy="no-referrer"
					src={entry.item.thumbnail ?? ''}
					alt=""
					loading="lazy"
					onload={onImageLoad}
					onerror={() => (imageFailed = true)}
				/>
				<span class="feed-zoom" aria-hidden="true"><Icon name="expand" size={15} /></span>
			</button>
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

			{#if entry.item.summary}
				<p
					bind:this={summaryEl}
					class="feed-summary"
					class:clamped={variant === 'completo' && !expanded}
				>
					{#each splitHighlights(entry.item.summary, terms) as segment, index (index)}
						{#if segment.highlight}
							<mark>{segment.text}</mark>
						{:else}
							{segment.text}
						{/if}
					{/each}
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

{#if imageOpen && entry.item.thumbnail}
	<ImageLightbox
		src={entry.item.thumbnail}
		title={entry.item.title}
		publicationUrl={entry.item.url}
		onclose={() => (imageOpen = false)}
	/>
{/if}

{#if redditOpen && redditVideo}
	<RedditPlayerDialog
		embedUrl={redditVideo}
		postUrl={reddit?.canonicalUrl ?? entry.item.url}
		title={entry.item.title}
		locale={entry.source.locale}
		onclose={() => (redditOpen = false)}
	/>
{/if}
