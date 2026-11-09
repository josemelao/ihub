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
	{:else if name === 'check'}
		<path d="M5 12l5 5 9-10" />
	{:else if name === 'x'}
		<path d="M6 6l12 12M18 6L6 18" />
	{:else if name === 'filter'}
		<path d="M3 5h18l-7 8v6l-4-2v-4z" />
	{/if}
</svg>
