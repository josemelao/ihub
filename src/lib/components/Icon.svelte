<script lang="ts">
	let { name, size = 18 }: { name: string; size?: number } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.8"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#if name === 'home'}
		<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
	{:else if name === 'rss'}
		<path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" />
		<circle cx="5" cy="19" r="1" />
	{:else if name === 'star'}
		<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5l-5.4 3 1.2-6L3.3 9.3l6.1-.7z" />
	{:else if name === 'monitor'}
		<rect x="3" y="4" width="18" height="13" rx="2" />
		<path d="M8 21h8M12 17v4" />
	{:else if name === 'settings'}
		<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
		<circle cx="16" cy="6" r="2" />
		<circle cx="10" cy="12" r="2" />
		<circle cx="18" cy="18" r="2" />
	{:else if name === 'plus'}
		<path d="M12 5v14M5 12h14" />
	{:else if name === 'search'}
		<circle cx="11" cy="11" r="7" />
		<path d="M21 21l-4.3-4.3" />
	{:else if name === 'arrow-left'}
		<path d="M15 18l-6-6 6-6" />
	{:else if name === 'chevron-down'}
		<path d="M6 9l6 6 6-6" />
	{:else if name === 'chevron-up'}
		<path d="M6 15l6-6 6 6" />
	{:else if name === 'chevron-right'}
		<path d="M9 6l6 6-6 6" />
	{:else if name === 'refresh'}
		<path d="M20 11a8 8 0 1 0-1.4 6" />
		<path d="M20 4v7h-7" />
	{:else if name === 'upload'}
		<path d="M12 21V9M7 14l5-5 5 5" />
		<path d="M5 3h14" />
	{:else if name === 'check'}
		<path d="M5 12l5 5 9-10" />
	{:else if name === 'x'}
		<path d="M6 6l12 12M18 6L6 18" />
	{:else if name === 'filter'}
		<path d="M3 5h18l-7 8v6l-4-2v-4z" />
	{:else if name === 'download'}
		<path d="M12 3v12M7 10l5 5 5-5" />
		<path d="M5 21h14" />
	{:else if name === 'archive'}
		<rect x="3" y="4" width="18" height="4" rx="1" />
		<path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
		<path d="M10 12h4" />
	{:else if name === 'external'}
		<path d="M14 3h7v7" />
		<path d="M10 14L21 3" />
		<path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
	{:else if name === 'bookmark'}
		<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
	{:else if name === 'circle'}
		<circle cx="12" cy="12" r="7" />
	{:else if name === 'check-circle'}
		<circle cx="12" cy="12" r="9" />
		<path d="M8 12l3 3 5-6" />
	{:else if name === 'book'}
		<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
		<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
	{:else if name === 'layers'}
		<path d="M12 3l9 5-9 5-9-5 9-5z" />
		<path d="M3 12.5l9 5 9-5" />
		<path d="M3 17l9 5 9-5" />
	{:else if name === 'play'}
		<path d="M8 5l11 7-11 7z" fill="currentColor" stroke="none" />
	{:else if name === 'expand'}
		<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5" />
	{/if}
</svg>
