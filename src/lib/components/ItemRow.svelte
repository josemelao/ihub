<script lang="ts">
	import { itemHref, itemKind } from '#lib/display';
	import type { HubItem } from '#lib/types';
	import ItemIcon from './ItemIcon.svelte';

	let { item, color }: { item: HubItem; color: string } = $props();

	const href = $derived(itemHref(item));
</script>

<a
	class="item-row"
	{href}
	target={item.type === 'link' ? '_blank' : undefined}
	rel="noopener noreferrer"
	title={item.description ?? undefined}
>
	<ItemIcon {item} {color} size={30} />
	<span class="item-name">{item.name}</span>
	<span class="item-kind">{itemKind(item)}</span>
</a>
