<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import type { FileImportSummary } from '#lib/import/apply';
	import { detectImportFormat } from '#lib/import/detect-format';
	import type { FileImportFormat, FileImportPreview } from '#lib/import/file-import';
	import {
		registerBackdropPointerDown,
		resetBackdropPointer,
		shouldCloseOnBackdropClick,
		type BackdropPointerState
	} from '#lib/dialog-backdrop';
	import { HttpResponseError, readJsonResponse } from '#lib/net/response';
	import type { HubData } from '#lib/types';
	import Icon from './Icon.svelte';

	let {
		hub,
		onclose,
		onimported
	}: {
		hub: HubData;
		onclose: () => void;
		onimported: (message: string) => void;
	} = $props();

	const MAX_FILE_BYTES = 10_000_000;

	let dialogEl = $state<HTMLDialogElement | null>(null);
	const backdropState: BackdropPointerState = { pointerDownOnBackdrop: false };

	let fileName = $state('');
	let format = $state<FileImportFormat | null>(null);
	let content = $state('');
	let categoryName = $state('');
	let preview = $state<FileImportPreview | null>(null);
	let error = $state('');
	let busy = $state(false);
	let requestId = 0;

	const categories = $derived([...hub.categories].sort((a, b) => a.order - b.order));

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

	function resetPreview(): void {
		preview = null;
		error = '';
		requestId += 1;
	}

	async function loadPreview(): Promise<void> {
		if (!format || !content.trim()) return;
		const request = ++requestId;
		busy = true;
		error = '';

		try {
			const response = await fetch('/api/import/file/preview', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					format,
					content,
					categoryName: categoryName.trim() || undefined
				})
			});
			const result = await readJsonResponse<{
				ok?: boolean;
				error?: string;
				preview?: FileImportPreview;
			}>(response);

			if (request !== requestId) return;
			if (!response.ok || !result.ok || !result.preview) {
				preview = null;
				error = result.error ?? 'Não foi possível analisar o arquivo.';
				return;
			}
			preview = result.preview;
		} catch (caught) {
			if (request !== requestId) return;
			preview = null;
			error =
				caught instanceof HttpResponseError
					? caught.message
					: `Falha de rede ao analisar: ${(caught as Error).message}`;
		} finally {
			if (request === requestId) busy = false;
		}
	}

	async function onFileChange(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		resetPreview();
		format = null;
		content = '';
		fileName = '';

		if (!file) return;
		fileName = file.name;

		if (file.size > MAX_FILE_BYTES) {
			error = 'O arquivo passa do limite de 10 MB.';
			return;
		}

		try {
			const text = await file.text();
			const detected = detectImportFormat(file.name, text);
			if (!detected) {
				error = 'Não reconheci o formato. Use um HTML de favoritos ou um arquivo OPML.';
				return;
			}
			format = detected;
			content = text;
			await loadPreview();
		} catch (caught) {
			error = `Não foi possível ler o arquivo: ${(caught as Error).message}`;
		}
	}

	async function onCategoryChange(): Promise<void> {
		resetPreview();
		await loadPreview();
	}

	async function confirmImport(): Promise<void> {
		if (!format || !content || !preview) return;
		busy = true;
		error = '';

		try {
			const response = await fetch('/api/import/file/apply', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					format,
					content,
					categoryName: categoryName.trim() || undefined
				})
			});
			const result = await readJsonResponse<{
				ok?: boolean;
				error?: string;
				summary?: FileImportSummary;
			}>(response);

			if (!response.ok || !result.ok || !result.summary) {
				error = result.error ?? 'Falha ao importar.';
				return;
			}

			const summary = result.summary;
			const parts = [
				summary.itemsAdded ? `${summary.itemsAdded} links` : '',
				summary.sourcesAdded ? `${summary.sourcesAdded} fontes` : '',
				summary.categoriesAdded ? `${summary.categoriesAdded} categorias` : '',
				summary.groupsAdded ? `${summary.groupsAdded} grupos` : ''
			].filter(Boolean);

			await invalidateAll();
			onimported(
				`Importado: ${parts.length > 0 ? parts.join(', ') : 'nada novo'}${
					summary.duplicates ? ` · ${summary.duplicates} duplicado(s) ignorado(s)` : ''
				}.`
			);
			onclose();
		} catch (caught) {
			error =
				caught instanceof HttpResponseError
					? caught.message
					: `Falha de rede ao importar: ${(caught as Error).message}`;
		} finally {
			busy = false;
		}
	}
</script>

<dialog
	bind:this={dialogEl}
	class="confirm-dialog"
	aria-label="Importar favoritos ou OPML"
	oncancel={handleCancel}
	onclick={handleBackdropClick}
	onpointerdown={handlePointerDown}
	onpointercancel={handlePointerCancel}
>
	<div class="confirm-body">
		<div class="confirm-head">
			<h2>Importar favoritos ou OPML</h2>
			<button type="button" class="palette-close" aria-label="Fechar" onclick={onclose}>
				<Icon name="x" size={16} />
			</button>
		</div>

		<p class="muted small">
			A importação apenas adiciona. Nada existente é apagado ou sobrescrito.
		</p>

		<div class="field">
			<label for="import-file">Arquivo (.html ou .opml)</label>
			<input
				id="import-file"
				type="file"
				accept=".html,.htm,.opml,.xml,text/html,text/xml,application/xml"
				onchange={onFileChange}
			/>
			{#if fileName}
				<span class="muted small">{fileName}</span>
			{/if}
		</div>

		<div class="field">
			<label for="import-category">Organizar</label>
			<select id="import-category" bind:value={categoryName} onchange={onCategoryChange}>
				<option value="">Criar categorias pelas pastas</option>
				{#each categories as category (category.id)}
					<option value={category.name}>{category.name}</option>
				{/each}
			</select>
		</div>

		{#if busy}
			<span class="muted small" role="status">Analisando o arquivo…</span>
		{/if}

		{#if error}
			<div class="alert" role="alert">{error}</div>
		{/if}

		{#if preview}
			<div class="chips" aria-live="polite">
				<span class="chip">{preview.summary.categoriesAdded} categorias novas</span>
				<span class="chip">{preview.summary.groupsAdded} grupos novos</span>
				{#if preview.format === 'bookmarks'}
					<span class="chip">{preview.summary.itemsAdded} links</span>
				{:else}
					<span class="chip">{preview.summary.sourcesAdded} fontes</span>
				{/if}
				{#if preview.summary.duplicates}
					<span class="chip">{preview.summary.duplicates} duplicados</span>
				{/if}
				{#if preview.summary.skipped}
					<span class="chip">{preview.summary.skipped} ignorados</span>
				{/if}
			</div>

			{#if preview.samples.length > 0}
				<ul class="muted small">
					{#each preview.samples as sample, index (index)}
						<li>{sample}</li>
					{/each}
				</ul>
			{/if}

			{#if preview.summary.warnings.length > 0}
				<ul class="muted small">
					{#each preview.summary.warnings as warning, index (index)}
						<li>{warning}</li>
					{/each}
				</ul>
			{/if}

			{#if preview.invalid.length > 0}
				<details>
					<summary class="muted small">
						{preview.invalid.length} item(ns) inválido(s)
					</summary>
					<ul class="muted small">
						{#each preview.invalid as issue, index (index)}
							<li><code>{issue.value || '—'}</code>: {issue.reason}</li>
						{/each}
					</ul>
				</details>
			{/if}
		{/if}

		<div class="confirm-actions">
			<button class="btn" type="button" onclick={onclose} disabled={busy}>Cancelar</button>
			<button
				class="btn btn-primary"
				type="button"
				onclick={confirmImport}
				disabled={busy || !preview}
			>
				{busy ? 'Importando…' : 'Confirmar importação'}
			</button>
		</div>
	</div>
</dialog>
