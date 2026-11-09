<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Icon from '#lib/components/Icon.svelte';
	import { relativeTime } from '#lib/display';
	import { HubValidationError, parseHub } from '#lib/schema';
	import type { ExportBundle, HubState, ValidationIssue } from '#lib/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const hub = $derived(data.hub);
	const catName = $derived(Object.fromEntries(hub.categories.map((cat) => [cat.id, cat.name])));
	const colors = $derived(Object.fromEntries(hub.categories.map((cat) => [cat.id, cat.color])));

	const linkCount = $derived(hub.items.filter((item) => item.type === 'link').length);
	const appCount = $derived(hub.items.filter((item) => item.type === 'app').length);

	const typeLabels: Record<string, string> = {
		rss: 'RSS / Atom',
		youtube: 'YouTube',
		reddit: 'Reddit'
	};

	let fileInput = $state<HTMLInputElement | null>(null);
	let pending = $state<ExportBundle | null>(null);
	let mode = $state<'replace' | 'merge'>('merge');
	let fileName = $state('');
	let error = $state('');
	let issues = $state<ValidationIssue[]>([]);
	let message = $state('');
	let busy = $state(false);
	let refreshing = $state(false);
	let refreshMessage = $state('');
	let refreshFailed = $state(false);

	async function refreshNow(): Promise<void> {
		refreshing = true;
		refreshMessage = '';
		refreshFailed = false;

		try {
			const response = await fetch('/api/refresh', { method: 'POST' });
			const result = (await response.json()) as {
				ok?: boolean;
				error?: string;
				results?: { ok: boolean; name: string }[];
			};

			if (!result.ok) {
				refreshMessage = result.error ?? 'Falha ao atualizar o feed.';
				refreshFailed = true;
			} else {
				const failed = (result.results ?? []).filter((entry) => !entry.ok);
				refreshFailed = failed.length > 0;
				refreshMessage =
					failed.length > 0
						? `Atualizado com falha em: ${failed.map((entry) => entry.name).join(', ')}`
						: 'Feed atualizado.';
			}
			await invalidateAll();
		} catch {
			refreshMessage = 'Falha de rede ao atualizar o feed.';
			refreshFailed = true;
		} finally {
			refreshing = false;
		}
	}

	function resetFeedback(): void {
		error = '';
		issues = [];
		message = '';
	}

	async function onFileChange(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		pending = null;
		resetFeedback();
		if (!file) return;

		fileName = file.name;
		try {
			const raw: unknown = JSON.parse(await file.text());
			const isBundle =
				typeof raw === 'object' && raw !== null && 'hub' in raw && (raw as { hub: unknown }).hub;
			const source = isBundle ? (raw as { hub: unknown }).hub : raw;
			const state =
				typeof raw === 'object' && raw !== null && 'state' in raw
					? (raw as { state?: HubState }).state
					: undefined;

			pending = { hub: parseHub(source), state };
		} catch (caught) {
			if (caught instanceof HubValidationError) {
				error = caught.message;
				issues = caught.issues;
			} else {
				error = `Não foi possível ler o arquivo: ${(caught as Error).message}`;
			}
		}
	}

	async function confirmImport(): Promise<void> {
		if (!pending) return;
		busy = true;
		resetFeedback();

		try {
			const response = await fetch('/api/import', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ bundle: pending, mode })
			});
			const result = (await response.json()) as {
				ok?: boolean;
				error?: string;
				issues?: ValidationIssue[];
				summary?: { categories: number; items: number; feedSources: number };
			};

			if (!response.ok || !result.ok) {
				error = result.error ?? 'Falha ao importar.';
				issues = result.issues ?? [];
				return;
			}

			const summary = result.summary;
			message = `Importado (${mode === 'replace' ? 'substituir' : 'mesclar'}): ${
				summary?.categories ?? 0
			} categorias, ${summary?.items ?? 0} itens e ${summary?.feedSources ?? 0} fontes.`;
			cancelImport();
			await invalidateAll();
		} catch (caught) {
			error = `Falha de rede ao importar: ${(caught as Error).message}`;
		} finally {
			busy = false;
		}
	}

	function cancelImport(): void {
		pending = null;
		fileName = '';
		if (fileInput) fileInput.value = '';
	}
</script>

<svelte:head>
	<title>Gerenciar · Meu Hub</title>
</svelte:head>

<a class="chip link" href={resolve('/')}>
	<Icon name="arrow-left" size={16} />
	Voltar ao início
</a>

<div class="section-head">
	<h1>Gerenciar fontes e links</h1>
	<button class="btn" type="button" disabled title="Importação de OPML chega na V3">
		Importar favoritos / OPML
	</button>
</div>

<div class="chips">
	<a class="btn" href={resolve('/api/export')} download>Exportar dados</a>
	<button class="btn" type="button" onclick={() => fileInput?.click()}>Importar dados</button>
	<button class="btn" type="button" onclick={refreshNow} disabled={refreshing}>
		{refreshing ? 'Atualizando...' : 'Atualizar agora'}
	</button>
	<input
		bind:this={fileInput}
		type="file"
		accept="application/json,.json"
		onchange={onFileChange}
		hidden
	/>
</div>

{#if refreshMessage}
	<div class:alert={refreshFailed} class:notice={!refreshFailed} role="status">
		{refreshMessage}
	</div>
{/if}

{#if error}
	<div class="alert" role="alert">
		<strong>{error}</strong>
		{#if issues.length > 0}
			<ul>
				{#each issues.slice(0, 8) as issue, index (index)}
					<li>
						<code>{issue.path.length ? issue.path.join(' › ') : 'arquivo'}</code>: {issue.message}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}

{#if message}
	<div class="notice" role="status">{message}</div>
{/if}

{#if pending}
	<div class="panel section">
		<div class="section-head">
			<h2 style="font-size: 16px">Revisar importação</h2>
			<span class="muted small">{fileName}</span>
		</div>
		<div class="chips">
			<span class="chip">{pending.hub.categories.length} categorias</span>
			<span class="chip">{pending.hub.groups.length} grupos</span>
			<span class="chip">{pending.hub.items.length} itens</span>
			<span class="chip">{pending.hub.feedSources.length} fontes</span>
		</div>
		<div class="chips" role="group" aria-label="Modo de importação">
			<button
				class="chip"
				class:active={mode === 'replace'}
				type="button"
				aria-pressed={mode === 'replace'}
				onclick={() => (mode = 'replace')}
			>
				Substituir tudo
			</button>
			<button
				class="chip"
				class:active={mode === 'merge'}
				type="button"
				aria-pressed={mode === 'merge'}
				onclick={() => (mode = 'merge')}
			>
				Mesclar por id
			</button>
		</div>
		<div class="chips">
			<button class="btn btn-primary" type="button" onclick={confirmImport} disabled={busy}>
				{busy ? 'Importando...' : 'Confirmar importação'}
			</button>
			<button class="btn" type="button" onclick={cancelImport} disabled={busy}>Cancelar</button>
		</div>
		<span class="muted small">Um backup do hub atual é criado automaticamente.</span>
	</div>
{/if}

<div class="tabs">
	<span class="tab active">Fontes do feed · {hub.feedSources.length}</span>
	<span class="tab">Links · {linkCount}</span>
	<span class="tab">Apps do PC · {appCount}</span>
	<span class="tab">Categorias · {hub.categories.length}</span>
	<span class="tab">Regras do feed</span>
</div>

<div class="table-scroll">
	<div class="table">
		<div class="table-head">
			<span class="col-source">Fonte</span>
			<span class="col-type">Tipo</span>
			<span class="col-cat">Categoria</span>
			<span class="col-every">Intervalo</span>
			<span class="col-toggle">Ativa</span>
		</div>

		{#each hub.feedSources as source (source.id)}
			{@const status = data.feed.sources[source.id]}
			<div class="table-row">
				<div class="col-source">
					<span
						class="item-avatar"
						style="background: {colors[source.categoryId] ?? '#8AA4FF'}22; color: {colors[
							source.categoryId
						] ?? '#8AA4FF'}"
					>
						{source.name.slice(0, 2).toUpperCase()}
					</span>
					<span style="display: flex; flex-direction: column; min-width: 0">
						<span style="font-weight: 500">{source.name}</span>
						<span
							class="muted small"
							style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap"
						>
							{source.target}
						</span>
						<span class="muted small">
							{#if status?.error}
								<span style="color: #f2c7c7">falhou: {status.error}</span>
							{:else if status?.lastFetchedAt}
								atualizado {relativeTime(status.lastFetchedAt)} · {status.count} posts
							{:else}
								nunca atualizada
							{/if}
						</span>
					</span>
				</div>
				<span class="col-type">{typeLabels[source.type] ?? source.type}</span>
				<span class="col-cat">{catName[source.categoryId] ?? source.categoryId}</span>
				<span class="col-every">
					{source.intervalMinutes >= 60
						? `${source.intervalMinutes / 60} h`
						: `${source.intervalMinutes} min`}
				</span>
				<span class="col-toggle">
					<span
						class="switch"
						class:on={source.enabled}
						title={source.enabled ? 'Ativa' : 'Desligada'}
					>
						<span class="knob"></span>
					</span>
				</span>
			</div>
		{/each}
	</div>
</div>

<div class="placeholder-panel">
	<span class="placeholder-title">Leitura + dados na V2</span>
	<span class="muted">
		Exportar/importar já funciona. O painel "Adicionar", o liga/desliga funcional e a detecção
		automática de RSS chegam na V3. Edite o <code>hub.json</code> e recarregue para mudanças manuais.
	</span>
</div>
