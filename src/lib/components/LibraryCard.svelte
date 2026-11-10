<script lang="ts">
	import { itemHref, itemPlatform } from '#lib/display';
	import type { HubItem } from '#lib/types';
	import ItemIcon from './ItemIcon.svelte';

	let { item, color }: { item: HubItem; color: string } = $props();

	function detail(): string {
		if (item.type === 'app') return item.launch.value;
		try {
			return new URL(item.url).hostname.replace(/^www\./, '');
		} catch {
			return item.url;
		}
	}
</script>

<a
	class="library-card"
	href={itemHref(item)}
	target={item.type === 'link' ? '_blank' : undefined}
	rel="noopener noreferrer"
	title={`Abrir ${item.name}`}
>
	<ItemIcon {item} {color} size={40} />
	<span class="library-card-main">
		<span class="library-card-name">{item.name}</span>
		<span class="library-card-meta">{detail()}</span>
	</span>
	<span class="library-badge" class:pc={item.type === 'app'}>
		{itemPlatform(item)}
	</span>
</a>
