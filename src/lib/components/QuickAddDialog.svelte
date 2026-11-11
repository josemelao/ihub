<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		registerBackdropPointerDown,
		resetBackdropPointer,
		shouldCloseOnBackdropClick,
		type BackdropPointerState
	} from '#lib/dialog-backdrop';
	import { readJsonResponse } from '#lib/net/response';
	import { toSafeHttpUrl } from '#lib/net/url';
	import { buildQuickAddHref, type QuickAddMetadata } from '#lib/quick-add';
	import Icon from './Icon.svelte';

	let { onclose }: { onclose: () => void } = $props();

	let dialogEl = $state<HTMLDialogElement | null>(null);
	const backdropState: BackdropPointerState = { pointerDownOnBackdrop: false };

	let url = $state('');
	let name = $state('');
	let busy = $state(false);
	let error = $state('');

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

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		error = '';

		const safeUrl = toSafeHttpUrl(url);
		if (!safeUrl) {
			error = 'Use uma URL http:// ou https://.';
			return;
		}

		busy = true;
		let metadata: QuickAddMetadata = {};

		try {
			const response = await fetch('/api/link-metadata', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ url: safeUrl })
			});
			const result = await readJsonResponse<{ ok?: boolean; metadata?: QuickAddMetadata }>(
				response
			);
			if (result.ok && result.metadata) metadata = result.metadata;
		} catch {
			// Sem metadados: o editor abre só com a URL, sem bloquear o usuário.
		}

		if (name.trim()) metadata = { ...metadata, name: name.trim() };

		const href = buildQuickAddHref(window.location.origin, safeUrl, metadata);
		onclose();
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- deep link dinâmico com query string
		await goto(href);
	}
</script>

<dialog
	bind:this={dialogEl}
	class="confirm-dialog"
	aria-label="Adicionar link rápido"
	oncancel={handleCancel}
	onclick={handleBackdropClick}
	onpointerdown={handlePointerDown}
	onpointercancel={handlePointerCancel}
>
	<form class="confirm-body" onsubmit={submit}>
		<div class="confirm-head">
			<h2>Adicionar link</h2>
			<button type="button" class="palette-close" aria-label="Fechar" onclick={onclose}>
				<Icon name="x" size={16} />
			</button>
		</div>

		<p class="muted small">O título, a descrição e o ícone são buscados na página.</p>

		<div class="field">
			<label for="quick-add-url">URL</label>
			<input
				id="quick-add-url"
				type="url"
				placeholder="https://exemplo.com/pagina"
				bind:value={url}
				required
			/>
		</div>

		<div class="field">
			<label for="quick-add-name">Nome (opcional)</label>
			<input
				id="quick-add-name"
				type="text"
				bind:value={name}
				placeholder="Deixe vazio para buscar"
			/>
		</div>

		{#if error}
			<div class="alert" role="alert">{error}</div>
		{/if}

		<div class="confirm-actions">
			<button class="btn" type="button" onclick={onclose} disabled={busy}>Cancelar</button>
			<button class="btn btn-primary" type="submit" disabled={busy}>
				{busy ? 'Lendo a página…' : 'Adicionar'}
			</button>
		</div>
	</form>
</dialog>
