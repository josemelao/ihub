<script lang="ts">
	import { initials, itemHref, itemKind, tint } from '#lib/display';
	import type { HubItem } from '#lib/types';

	let { item, color }: { item: HubItem; color: string } = $props();

	const href = $derived(itemHref(item));
</script>

<a
	class="item-row"
	{href}
	target={item.type === 'link' ? '_blank' : undefined}
	rel="noopener noreferrer"
>
	<span class="item-avatar" style="background: {tint(color, 0.16)}; color: {color}">
		{initials(item.name)}
	</span>
	<span class="item-name">{item.name}</span>
	<span class="item-kind">{itemKind(item)}</span>
</a>
