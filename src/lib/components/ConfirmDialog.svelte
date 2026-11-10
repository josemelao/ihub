<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import {
		registerBackdropPointerDown,
		resetBackdropPointer,
		shouldCloseOnBackdropClick,
		type BackdropPointerState
	} from '#lib/dialog-backdrop';
	import Icon from './Icon.svelte';

	let {
		title,
		message,
		confirmLabel = 'Remover',
		cancelLabel = 'Cancelar',
		onconfirm,
		oncancel
	}: {
		title: string;
		message: string;
		confirmLabel?: string;
		cancelLabel?: string;
		onconfirm: () => void;
		oncancel: () => void;
	} = $props();

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
		oncancel();
	}

	function handleBackdropClick(event: MouseEvent): void {
		if (shouldCloseOnBackdropClick(backdropState, event.target, dialogEl)) oncancel();
	}

	function handlePointerDown(event: PointerEvent): void {
		registerBackdropPointerDown(backdropState, event.target, dialogEl);
	}

	function handlePointerCancel(): void {
		resetBackdropPointer(backdropState);
	}
</script>

<dialog
	bind:this={dialogEl}
	class="confirm-dialog"
	aria-label={title}
	oncancel={handleCancel}
	onclick={handleBackdropClick}
	onpointerdown={handlePointerDown}
	onpointercancel={handlePointerCancel}
>
	<div class="confirm-body">
		<div class="confirm-head">
			<h2>{title}</h2>
			<button type="button" class="palette-close" aria-label="Fechar" onclick={oncancel}>
				<Icon name="x" size={16} />
			</button>
		</div>
		<p class="muted">{message}</p>
		<div class="confirm-actions">
			<button class="btn" type="button" onclick={oncancel}>{cancelLabel}</button>
			<button class="btn btn-danger" type="button" onclick={onconfirm}>{confirmLabel}</button>
		</div>
	</div>
</dialog>
