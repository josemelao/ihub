<script lang="ts">
	import { HIGHLIGHT_COLORS, HIGHLIGHT_COLOR_LABELS } from '#lib/reader/highlights';
	import type { HighlightColor } from '#lib/types';

	let {
		x,
		y,
		onpick,
		onannotate,
		onclose
	}: {
		x: number;
		y: number;
		onpick: (color: HighlightColor) => void;
		onannotate: () => void;
		onclose: () => void;
	} = $props();
</script>

<div
	class="highlight-toolbar"
	role="toolbar"
	tabindex="-1"
	aria-label="Destacar seleção"
	style="left: {x}px; top: {y}px"
	onpointerdown={(event) => event.preventDefault()}
>
	{#each HIGHLIGHT_COLORS as color (color)}
		<button
			type="button"
			class="hl-swatch hl-{color}"
			aria-label="Destacar em {HIGHLIGHT_COLOR_LABELS[color]}"
			title="Destacar em {HIGHLIGHT_COLOR_LABELS[color]}"
			onclick={() => onpick(color)}
		></button>
	{/each}
	<button type="button" class="hl-action" onclick={onannotate}>Anotar</button>
	<button type="button" class="hl-action" aria-label="Fechar barra de destaque" onclick={onclose}>
		×
	</button>
</div>
