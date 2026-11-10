<script lang="ts">
	import { initials, itemIconUrl, tint } from '#lib/display';
	import type { HubItem } from '#lib/types';

	let {
		item,
		color = '#8AA4FF',
		size = 34
	}: { item: HubItem; color?: string; size?: number } = $props();

	const src = $derived(itemIconUrl(item, color));
</script>

<span
	class="item-icon"
	style="width: {size}px; height: {size}px; font-size: {Math.max(
		10,
		Math.round(size * 0.34)
	)}px; background: {tint(color, 0.16)}; color: {color}"
	aria-hidden="true"
>
	<span class="item-icon-fallback">{initials(item.name)}</span>
	{#if src}
		{#key src}
			<img
				{src}
				alt=""
				loading="lazy"
				decoding="async"
				onerror={(event) => {
					(event.currentTarget as HTMLImageElement).style.display = 'none';
				}}
			/>
		{/key}
	{/if}
</span>
