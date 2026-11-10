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
		embedUrl,
		postUrl,
		title,
		onclose
	}: { embedUrl: string; postUrl: string; title: string; onclose: () => void } = $props();

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
	class="reddit-dialog"
	aria-label={`Mídia do Reddit: ${title}`}
	oncancel={handleCancel}
	onclick={handleBackdropClick}
	onpointerdown={handlePointerDown}
	onpointercancel={handlePointerCancel}
>
	<div class="reddit-body">
		<div class="reddit-head">
			<h2>{title}</h2>
			<button type="button" class="palette-close" aria-label="Fechar mídia" onclick={onclose}>
				<Icon name="x" size={16} />
			</button>
		</div>

		<div class="reddit-frame">
			<iframe
				src={embedUrl}
				title={`Mídia do Reddit: ${title}`}
				allow="autoplay; encrypted-media; picture-in-picture"
				referrerpolicy="strict-origin-when-cross-origin"
				allowfullscreen
			></iframe>
		</div>

		<div class="reddit-actions">
			<a class="chip link" href={postUrl} target="_blank" rel="noopener noreferrer">
				<Icon name="external" size={16} />
				Abrir no Reddit
			</a>
		</div>
	</div>
</dialog>
