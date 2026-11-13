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
		fallbackSrc,
		title,
		publicationUrl,
		onplayer,
		onclose
	}: {
		src: string;
		fallbackSrc?: string;
		title: string;
		publicationUrl: string;
		onplayer?: () => void;
		onclose: () => void;
	} = $props();

	let dialogEl = $state<HTMLDialogElement | null>(null);
	let fallbackActive = $state(false);
	let imageFailed = $state(false);
	const currentSrc = $derived(fallbackActive && fallbackSrc ? fallbackSrc : src);
	const backdropState: BackdropPointerState = { pointerDownOnBackdrop: false };

	onMount(() => {
		dialogEl?.showModal();
		dialogEl?.querySelector<HTMLButtonElement>('button')?.focus();
	});

	onDestroy(() => {
		dialogEl?.close();
	});

	function handleImageError(): void {
		if (!fallbackActive && fallbackSrc && fallbackSrc !== src) {
			fallbackActive = true;
			return;
		}
		imageFailed = true;
	}

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
			{#if imageFailed}
				<p class="muted">Não foi possível carregar a imagem.</p>
			{:else}
				<img
					referrerpolicy="no-referrer"
					src={currentSrc}
					alt={title}
					decoding="async"
					onerror={handleImageError}
				/>
			{/if}
		</div>

		<div class="image-actions">
			{#if onplayer}
				<button class="chip link" type="button" onclick={onplayer}>
					<Icon name="play" size={16} />
					Ver no player
				</button>
			{/if}
			<a class="chip link" href={currentSrc} target="_blank" rel="noopener noreferrer">
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
