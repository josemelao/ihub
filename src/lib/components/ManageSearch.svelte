<script lang="ts">
	import Icon from './Icon.svelte';

	let {
		value = $bindable(''),
		id,
		label,
		placeholder
	}: { value?: string; id: string; label: string; placeholder: string } = $props();
</script>

<div class="manage-search">
	<div class="filter-input">
		<Icon name="search" size={16} />
		<label class="sr-only" for={id}>{label}</label>
		<input {id} bind:value {placeholder} />
	</div>
	{#if value}
		<button class="chip" type="button" onclick={() => (value = '')}>Limpar</button>
	{/if}
</div>
