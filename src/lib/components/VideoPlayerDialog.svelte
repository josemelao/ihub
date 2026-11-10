<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import {
		registerBackdropPointerDown,
		resetBackdropPointer,
		shouldCloseOnBackdropClick,
		type BackdropPointerState
	} from '#lib/dialog-backdrop';
	import Icon from './Icon.svelte';

	let { videoId, title, onclose }: { videoId: string; title: string; onclose: () => void } =
		$props();

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
	class="video-dialog"
	aria-label={`Reproduzir: ${title}`}
	oncancel={handleCancel}
	onclick={handleBackdropClick}
	onpointerdown={handlePointerDown}
	onpointercancel={handlePointerCancel}
>
	<div class="video-body">
		<div class="video-head">
			<h2>{title}</h2>
			<button type="button" class="palette-close" aria-label="Fechar player" onclick={onclose}>
				<Icon name="x" size={16} />
			</button>
		</div>

		<div class="video-frame">
			<iframe
				src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
				title={`Reproduzir: ${title}`}
				allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
				referrerpolicy="strict-origin-when-cross-origin"
				allowfullscreen
			></iframe>
		</div>

		<div class="video-actions">
			<a
				class="chip link"
				href={`https://www.youtube.com/watch?v=${videoId}`}
				target="_blank"
				rel="noopener noreferrer"
			>
				<Icon name="external" size={16} />
				Abrir no YouTube
			</a>
		</div>
	</div>
</dialog>
