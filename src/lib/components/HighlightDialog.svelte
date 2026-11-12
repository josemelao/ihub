<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import {
		registerBackdropPointerDown,
		resetBackdropPointer,
		shouldCloseOnBackdropClick,
		type BackdropPointerState
	} from '#lib/dialog-backdrop';
	import { HIGHLIGHT_COLORS, HIGHLIGHT_COLOR_LABELS } from '#lib/reader/highlight-meta';
	import type { HighlightColor } from '#lib/types';
	import Icon from './Icon.svelte';

	let {
		quote,
		initialColor,
		initialNote,
		onsave,
		onclose
	}: {
		quote: string;
		initialColor: HighlightColor;
		initialNote: string;
		onsave: (value: { color: HighlightColor; note: string }) => void;
		onclose: () => void;
	} = $props();

	let color = $state<HighlightColor>(untrack(() => initialColor));
	let note = $state(untrack(() => initialNote));
	let dialogEl = $state<HTMLDialogElement | null>(null);
	const backdropState: BackdropPointerState = { pointerDownOnBackdrop: false };

	onMount(() => {
		dialogEl?.showModal();
	});

	onDestroy(() => {
		dialogEl?.close();
	});

	function handleCancel(event: Event): void {
		event.preventDefault();
		onclose();
	}

	function handleBackdropClick(event: MouseEvent): void {
		if (shouldCloseOnBackdropClick(backdropState, event.target, dialogEl)) onclose();
	}

	function handlePointerDown(event: PointerEvent): void {
		registerBackdropPointerDown(backdropState, event.target, dialogEl);
	}

	function handlePointerCancel(): void {
		resetBackdropPointer(backdropState);
	}

	function handleSubmit(event: SubmitEvent): void {
		event.preventDefault();
		onsave({ color, note });
	}
</script>

<dialog
	bind:this={dialogEl}
	class="confirm-dialog"
	aria-label="Anotar destaque"
	oncancel={handleCancel}
	onclick={handleBackdropClick}
	onpointerdown={handlePointerDown}
	onpointercancel={handlePointerCancel}
>
	<form method="dialog" class="confirm-body" onsubmit={handleSubmit}>
		<div class="confirm-head">
			<h2>Anotar destaque</h2>
			<button type="button" class="palette-close" aria-label="Fechar" onclick={onclose}>
				<Icon name="x" size={16} />
			</button>
		</div>

		<blockquote class="muted hl-quote">{quote}</blockquote>

		<fieldset class="hl-colors">
			<legend class="small">Cor</legend>
			{#each HIGHLIGHT_COLORS as value (value)}
				<label class="hl-choice hl-{value}">
					<input type="radio" name="hl-color" {value} bind:group={color} />
					{HIGHLIGHT_COLOR_LABELS[value]}
				</label>
			{/each}
		</fieldset>

		<div class="field">
			<label for="hl-note">Nota</label>
			<textarea
				id="hl-note"
				bind:value={note}
				maxlength="2000"
				rows="3"
				placeholder="Por que vale revisar?"></textarea>
		</div>

		<div class="confirm-actions">
			<button class="btn" type="button" onclick={onclose}>Cancelar</button>
			<button class="btn btn-primary" type="submit">Salvar</button>
		</div>
	</form>
</dialog>
