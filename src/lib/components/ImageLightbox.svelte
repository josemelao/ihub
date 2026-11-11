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
		src,
		title,
		publicationUrl,
		onclose
	}: { src: string; title: string; publicationUrl: string; onclose: () => void } = $props();

	let dialogEl = $state<HTMLDialogElement | null>(null);
	const backdropState: BackdropPointerState = { pointerDownOnBackdrop: false };

	onMount(() => {
		dialogEl?.showModal();
		dialogEl?.querySelector<HTMLButtonElement>('button')?.focus();
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
</script>

<dialog
	bind:this={dialogEl}
	class="image-dialog"
	aria-label={`Imagem: ${title}`}
	oncancel={handleCancel}
	onclick={handleBackdropClick}
	onpointerdown={handlePointerDown}
	onpointercancel={handlePointerCancel}
>
	<div class="image-body">
		<div class="image-head">
			<h2>{title}</h2>
			<button type="button" class="palette-close" aria-label="Fechar imagem" onclick={onclose}>
				<Icon name="x" size={16} />
			</button>
		</div>

		<div class="image-frame">
			<img referrerpolicy="no-referrer" {src} alt={title} decoding="async" />
		</div>

		<div class="image-actions">
			<a class="chip link" href={src} target="_blank" rel="noopener noreferrer">
				<Icon name="external" size={16} />
				Abrir imagem
			</a>
			<a class="chip link" href={publicationUrl} target="_blank" rel="noopener noreferrer">
				<Icon name="external" size={16} />
				Abrir publicação
			</a>
		</div>
	</div>
</dialog>
