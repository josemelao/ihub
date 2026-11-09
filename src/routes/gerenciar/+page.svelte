<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Icon from '#lib/components/Icon.svelte';
	import ManageEditor from '#lib/components/ManageEditor.svelte';
	import { initials, relativeTime, tint } from '#lib/display';
	import { HubValidationError, parseHub } from '#lib/schema';
	import type {
		Category,
		ExportBundle,
		FeedSource,
		HubItem,
		HubState,
		SavedFilter,
		ValidationIssue
	} from '#lib/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const hub = $derived(data.hub);
	const catName = $derived(Object.fromEntries(hub.categories.map((cat) => [cat.id, cat.name])));
	const colors = $derived(Object.fromEntries(hub.categories.map((cat) => [cat.id, cat.color])));
	const groupName = $derived(Object.fromEntries(hub.groups.map((group) => [group.id, group.name])));

	const linkCount = $derived(hub.items.filter((item) => item.type === 'link').length);
	const appCount = $derived(hub.items.filter((item) => item.type === 'app').length);

	const typeLabels: Record<string, string> = {
		rss: 'RSS / Atom',
		youtube: 'YouTube',
		reddit: 'Reddit'
	};

	type Tab = 'fontes' | 'links' | 'apps' | 'categorias' | 'regras';
	type EditorKind = 'link' | 'app' | 'source' | 'category' | 'filter';

	let tab = $state<Tab>('fontes');
	let editor = $state<{
		kind: EditorKind;
		initial: HubItem | FeedSource | Category | SavedFilter | null;
		key: number;
	} | null>(null);

	let actionError = $state('');
	let actionMessage = $state('');
	let actionIssues = $state<ValidationIssue[]>([]);

	const tabs = $derived([
		{ id: 'fontes' as const, label: `Fontes do feed · ${hub.feedSources.length}` },
		{ id: 'links' as const, label: `Links · ${linkCount}` },
		{ id: 'apps' as const, label: `Apps do PC · ${appCount}` },
		{ id: 'categorias' as const, label: `Categorias · ${hub.categories.length}` },
		{ id: 'regras' as const, label: `Regras do feed · ${hub.savedFilters.length}` }
	]);

	const addKind = $derived<EditorKind>(
		tab === 'fontes'
			? 'source'
			: tab === 'links'
				? 'link'
				: tab === 'apps'
					? 'app'
					: tab === 'categorias'
						? 'category'
						: 'filter'
	);

	const addLabel = $derived(
		tab === 'fontes'
			? 'Adicionar fonte'
			: tab === 'links'
				? 'Adicionar link'
				: tab === 'apps'
					? 'Adicionar app'
					: tab === 'categorias'
						? 'Adicionar categoria'
						: 'Adicionar filtro'
	);

	function openEditor(
		kind: EditorKind,
		initial: HubItem | FeedSource | Category | SavedFilter | null = null
	): void {
		editor = { kind, initial, key: Date.now() };
	}

	async function mutate(payload: Record<string, unknown>): Promise<void> {
		actionError = '';
		actionMessage = '';
		actionIssues = [];

		try {
			const response = await fetch('/api/hub', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const result = (await response.json()) as {
				ok?: boolean;
				error?: string;
				issues?: ValidationIssue[];
			};

			if (!response.ok || !result.ok) {
				actionError = result.error ?? 'Não foi possível salvar.';
				actionIssues = result.issues ?? [];
				return;
			}

			actionMessage = 'Alteração salva.';
			await invalidateAll();
		} catch {
			actionError = 'Falha de rede ao salvar.';
		}
	}

	function removeEntry(
		kind: 'item' | 'source' | 'category' | 'filter',
		id: string,
		label: string
	): void {
		if (!confirm(`Remover "${label}"?`)) return;
		void mutate({ action: `delete-${kind}`, id });
	}

	function itemsOf(type: 'link' | 'app'): HubItem[] {
		return hub.items
			.filter((item) => item.type === type)
			.sort((a, b) => {
				const catA = hub.categories.find((category) => category.id === a.categoryId)?.order ?? 0;
				const catB = hub.categories.find((category) => category.id === b.categoryId)?.order ?? 0;
				return catA - catB || a.order - b.order;
			});
	}

	// Exportar / importar
	let fileInput = $state<HTMLInputElement | null>(null);
	let pending = $state<ExportBundle | null>(null);
	let mode = $state<'replace' | 'merge'>('merge');
	let fileName = $state('');
	let importError = $state('');
	let importIssues = $state<ValidationIssue[]>([]);
	let importMessage = $state('');
	let busy = $state(false);

	let refreshing = $state(false);
	let refreshMessage = $state('');
	let refreshFailed = $state(false);

	function resetFeedback(): void {
		importError = '';
		importIssues = [];
		importMessage = '';
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
				importError = caught.message;
				importIssues = caught.issues;
			} else {
				importError = `Não foi possível ler o arquivo: ${(caught as Error).message}`;
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
				importError = result.error ?? 'Falha ao importar.';
				importIssues = result.issues ?? [];
				return;
			}

			const summary = result.summary;
			importMessage = `Importado (${mode === 'replace' ? 'substituir' : 'mesclar'}): ${
				summary?.categories ?? 0
			} categorias, ${summary?.items ?? 0} itens e ${summary?.feedSources ?? 0} fontes.`;
			cancelImport();
			await invalidateAll();
		} catch (caught) {
			importError = `Falha de rede ao importar: ${(caught as Error).message}`;
		} finally {
			busy = false;
		}
	}

	function cancelImport(): void {
		pending = null;
		fileName = '';
		if (fileInput) fileInput.value = '';
	}

	async function refreshNow(): Promise<void> {
		refreshing = true;
		refreshMessage = '';
		refreshFailed = false;

		try {
			const response = await fetch('/api/refresh', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: '{}'
			});
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
	<div class="chips">
		<button class="btn btn-primary" type="button" onclick={() => openEditor(addKind)}>
			<Icon name="plus" size={16} />
			{addLabel}
		</button>
	</div>
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

{#if actionError}
	<div class="alert" role="alert">
		<strong>{actionError}</strong>
		{#if actionIssues.length > 0}
			<ul>
				{#each actionIssues.slice(0, 6) as issue, index (index)}
					<li>
						<code>{issue.path.length ? issue.path.join(' › ') : 'arquivo'}</code>: {issue.message}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}

{#if actionMessage}
	<div class="notice" role="status">{actionMessage}</div>
{/if}

{#if importError}
	<div class="alert" role="alert">
		<strong>{importError}</strong>
		{#if importIssues.length > 0}
			<ul>
				{#each importIssues.slice(0, 8) as issue, index (index)}
					<li>
						<code>{issue.path.length ? issue.path.join(' › ') : 'arquivo'}</code>: {issue.message}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}

{#if importMessage}
	<div class="notice" role="status">{importMessage}</div>
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

<div class="tabs" role="tablist" aria-label="Seções do gerenciador">
	{#each tabs as entry (entry.id)}
		<button
			class="tab"
			class:active={tab === entry.id}
			type="button"
			role="tab"
			aria-selected={tab === entry.id}
			onclick={() => (tab = entry.id)}
		>
			{entry.label}
		</button>
	{/each}
</div>

{#if tab === 'fontes'}
	<div class="table-scroll">
		<div class="table">
			<div class="table-head">
				<span class="col-source">Fonte</span>
				<span class="col-type">Tipo</span>
				<span class="col-cat">Categoria</span>
				<span class="col-every">Intervalo</span>
				<span class="col-toggle">Ativa</span>
				<span class="col-actions">Ações</span>
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
						<button
							class="switch-button"
							type="button"
							aria-label={source.enabled ? 'Desligar fonte' : 'Ligar fonte'}
							onclick={() => mutate({ action: 'toggle-source', id: source.id })}
						>
							<span class="switch" class:on={source.enabled}>
								<span class="knob"></span>
							</span>
						</button>
					</span>
					<span class="col-actions">
						<div class="manage-actions">
							<button class="mini-btn" type="button" onclick={() => openEditor('source', source)}>
								Editar
							</button>
							<button
								class="mini-btn danger"
								type="button"
								onclick={() => removeEntry('source', source.id, source.name)}
							>
								Remover
							</button>
						</div>
					</span>
				</div>
			{/each}
		</div>
	</div>
{:else if tab === 'links' || tab === 'apps'}
	<div class="manage-list">
		{#each itemsOf(tab === 'links' ? 'link' : 'app') as item (item.id)}
			<div class="manage-row">
				<span
					class="item-avatar"
					style="background: {tint(colors[item.categoryId] ?? '#8AA4FF', 0.16)}; color: {colors[
						item.categoryId
					] ?? '#8AA4FF'}"
				>
					{initials(item.name)}
				</span>
				<span class="manage-main">
					<span class="manage-name">{item.name}</span>
					<span class="manage-sub">
						{catName[item.categoryId] ?? item.categoryId}
						{#if item.groupId}· {groupName[item.groupId] ?? item.groupId}{/if}
						· {item.type === 'link' ? item.url : item.launch.value}
					</span>
				</span>
				<div class="manage-actions">
					<button
						class="mini-btn"
						type="button"
						aria-label="Mover para cima"
						onclick={() => mutate({ action: 'move-item', id: item.id, direction: 'up' })}
					>
						↑
					</button>
					<button
						class="mini-btn"
						type="button"
						aria-label="Mover para baixo"
						onclick={() => mutate({ action: 'move-item', id: item.id, direction: 'down' })}
					>
						↓
					</button>
					<button
						class="mini-btn"
						type="button"
						onclick={() => openEditor(item.type === 'link' ? 'link' : 'app', item)}
					>
						Editar
					</button>
					<button
						class="mini-btn danger"
						type="button"
						onclick={() => removeEntry('item', item.id, item.name)}
					>
						Remover
					</button>
				</div>
			</div>
		{/each}
		{#if itemsOf(tab === 'links' ? 'link' : 'app').length === 0}
			<p class="muted">Nenhum {tab === 'links' ? 'link' : 'app'} cadastrado.</p>
		{/if}
	</div>
{:else if tab === 'categorias'}
	<div class="manage-list">
		{#each hub.categories as category (category.id)}
			<div class="manage-row">
				<span class="dot" style="background: {category.color}; width: 12px; height: 12px"></span>
				<span class="manage-main">
					<span class="manage-name">{category.name}</span>
					<span class="manage-sub">
						{hub.items.filter((item) => item.categoryId === category.id).length} itens ·
						{hub.groups.filter((group) => group.categoryId === category.id).length} grupos
					</span>
				</span>
				<div class="manage-actions">
					<button
						class="mini-btn"
						type="button"
						aria-label="Mover categoria para cima"
						onclick={() => mutate({ action: 'move-category', id: category.id, direction: 'up' })}
					>
						↑
					</button>
					<button
						class="mini-btn"
						type="button"
						aria-label="Mover categoria para baixo"
						onclick={() => mutate({ action: 'move-category', id: category.id, direction: 'down' })}
					>
						↓
					</button>
					<button class="mini-btn" type="button" onclick={() => openEditor('category', category)}>
						Editar
					</button>
					<button
						class="mini-btn danger"
						type="button"
						onclick={() => removeEntry('category', category.id, category.name)}
					>
						Remover
					</button>
				</div>
			</div>
		{/each}
	</div>
{:else}
	<div class="manage-list">
		{#each hub.savedFilters as filter (filter.id)}
			<div class="manage-row">
				<span class="manage-main">
					<span class="manage-name">{filter.label}</span>
					<span class="manage-sub">
						inclui: {filter.include.join(', ') || '—'} · exclui: {filter.exclude.join(', ') || '—'}
					</span>
				</span>
				<div class="manage-actions">
					<button
						class="mini-btn danger"
						type="button"
						onclick={() => removeEntry('filter', filter.id, filter.label)}
					>
						Remover
					</button>
				</div>
			</div>
		{/each}
		{#if hub.savedFilters.length === 0}
			<p class="muted">Nenhum filtro salvo.</p>
		{/if}
	</div>
{/if}

<div class="placeholder-panel">
	<span class="placeholder-title">Edição validada</span>
	<span class="muted">
		As alterações são validadas e gravadas no <code>hub.json</code> de forma atômica, com backup automático.
		Use ↑/↓ para reordenar itens e categorias.
	</span>
</div>

{#if editor}
	{#key editor.key}
		<ManageEditor
			kind={editor.kind}
			hub={data.hub}
			initial={editor.initial}
			onclose={() => (editor = null)}
		/>
	{/key}
{/if}
