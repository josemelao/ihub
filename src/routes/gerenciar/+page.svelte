<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import ItemIcon from '#lib/components/ItemIcon.svelte';
	import ManageEditor from '#lib/components/ManageEditor.svelte';
	import ManageSearch from '#lib/components/ManageSearch.svelte';
	import { relativeTime } from '#lib/display';
	import { HubValidationError, parseHub } from '#lib/schema';
	import type {
		Category,
		ExportBundle,
		FeedSource,
		Group,
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
	const sortedCategories = $derived([...hub.categories].sort((a, b) => a.order - b.order));

	function normalizeText(value: string): string {
		return value
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase();
	}

	function matchesQuery(query: string, ...parts: (string | undefined)[]): boolean {
		const terms = normalizeText(query).trim().split(/\s+/).filter(Boolean);
		if (terms.length === 0) return true;
		const haystack = normalizeText(parts.filter(Boolean).join('\n'));
		return terms.every((term) => haystack.includes(term));
	}

	function itemTarget(item: HubItem): string {
		return item.type === 'link' ? item.url : item.launch.value;
	}

	const sourceSections = $derived(
		sortedCategories
			.map((category) => ({
				category,
				sources: hub.feedSources.filter(
					(source) =>
						source.categoryId === category.id &&
						(sourceStatusFilter === 'all' || Boolean(data.feed.sources[source.id]?.error)) &&
						matchesQuery(
							sourceQuery,
							source.name,
							source.target,
							groupName[source.groupId ?? ''],
							category.name
						)
				)
			}))
			.filter((section) => section.sources.length > 0)
	);

	const itemSections = $derived.by(() => {
		return sortedCategories
			.map((category) => {
				const groups = hub.groups
					.filter((group) => group.categoryId === category.id)
					.sort((a, b) => a.order - b.order)
					.map((group) => ({
						id: group.id,
						name: group.name,
						items: hub.items
							.filter(
								(item) =>
									item.categoryId === category.id &&
									item.groupId === group.id &&
									(itemTypeFilter === 'todos' || item.type === itemTypeFilter) &&
									matchesQuery(
										itemQuery,
										item.name,
										item.description,
										itemTarget(item),
										item.tags.join(' '),
										category.name,
										group.name
									)
							)
							.sort((a, b) => a.order - b.order)
					}))
					.filter((group) => group.items.length > 0);

				const ungrouped = hub.items
					.filter(
						(item) =>
							item.categoryId === category.id &&
							!item.groupId &&
							(itemTypeFilter === 'todos' || item.type === itemTypeFilter) &&
							matchesQuery(
								itemQuery,
								item.name,
								item.description,
								itemTarget(item),
								item.tags.join(' '),
								category.name,
								'Sem grupo'
							)
					)
					.sort((a, b) => a.order - b.order);

				if (ungrouped.length > 0) {
					groups.push({ id: '__sem-grupo', name: 'Sem grupo', items: ungrouped });
				}

				return {
					category,
					groups,
					total: groups.reduce((sum, group) => sum + group.items.length, 0)
				};
			})
			.filter((section) => section.total > 0);
	});

	const groupSections = $derived(
		sortedCategories
			.map((category) => ({
				category,
				groups: hub.groups
					.filter(
						(group) =>
							group.categoryId === category.id &&
							matchesQuery(groupQuery, group.name, category.name)
					)
					.sort((a, b) => a.order - b.order)
			}))
			.filter((section) => section.groups.length > 0)
	);

	const filteredCategories = $derived(
		sortedCategories.filter((category) => matchesQuery(categoryQuery, category.name))
	);
	const filteredFilters = $derived(
		hub.savedFilters.filter((filter) =>
			matchesQuery(filterQuery, filter.label, filter.include.join(' '), filter.exclude.join(' '))
		)
	);

	const typeLabels: Record<string, string> = {
		rss: 'RSS / Atom',
		youtube: 'YouTube',
		reddit: 'Reddit'
	};

	type Tab = 'fontes' | 'itens' | 'grupos' | 'categorias' | 'filtros' | 'aparencia';
	type EditorKind = 'link' | 'app' | 'source' | 'category' | 'group' | 'filter';

	let tab = $state<Tab>('fontes');
	let itemTypeFilter = $state<'todos' | 'link' | 'app'>('todos');
	let sourceQuery = $state('');
	let itemQuery = $state('');
	let groupQuery = $state('');
	let categoryQuery = $state('');
	let filterQuery = $state('');
	let sourceStatusFilter = $state<'all' | 'erro'>('all');
	let focusedGroupId = $state<string | null>(null);
	let accent = $state(untrack(() => data.hub.settings.accent));
	let confirming = $state<{
		kind: 'item' | 'source' | 'category' | 'group' | 'filter';
		id: string;
		label: string;
	} | null>(null);
	let editor = $state<{
		kind: EditorKind;
		initial: HubItem | FeedSource | Category | Group | SavedFilter | null;
		preset: { categoryId?: string; groupId?: string };
		key: number;
	} | null>(null);

	const accentPresets = ['#8AA4FF', '#7DD3A8', '#F2A65A', '#E58BC0', '#B79CFF', '#F28B82'];

	let actionError = $state('');
	let actionMessage = $state('');
	let actionIssues = $state<ValidationIssue[]>([]);

	const tabs = $derived([
		{ id: 'fontes' as const, label: `Fontes do feed · ${hub.feedSources.length}` },
		{ id: 'itens' as const, label: `Itens · ${hub.items.length}` },
		{ id: 'grupos' as const, label: `Grupos · ${hub.groups.length}` },
		{ id: 'categorias' as const, label: `Categorias · ${hub.categories.length}` },
		{ id: 'filtros' as const, label: `Filtros salvos · ${hub.savedFilters.length}` },
		{ id: 'aparencia' as const, label: 'Aparência' }
	]);

	const addKind = $derived<EditorKind>(
		tab === 'fontes'
			? 'source'
			: tab === 'itens'
				? 'link'
				: tab === 'grupos'
					? 'group'
					: tab === 'categorias'
						? 'category'
						: 'filter'
	);

	const addLabel = $derived(
		tab === 'fontes'
			? 'Adicionar fonte'
			: tab === 'itens'
				? 'Adicionar link'
				: tab === 'grupos'
					? 'Adicionar grupo'
					: tab === 'categorias'
						? 'Adicionar categoria'
						: 'Adicionar filtro'
	);

	function openEditor(
		kind: EditorKind,
		initial: HubItem | FeedSource | Category | Group | SavedFilter | null = null,
		preset: { categoryId?: string; groupId?: string } = {}
	): void {
		editor = { kind, initial, preset, key: Date.now() };
	}

	onMount(() => {
		const params = page.url.searchParams;
		const requestedTab = params.get('tab');
		const validTabs: Tab[] = ['fontes', 'itens', 'grupos', 'categorias', 'filtros', 'aparencia'];
		if (requestedTab && validTabs.includes(requestedTab as Tab)) {
			tab = requestedTab as Tab;
		}

		if (params.get('status') === 'erro') sourceStatusFilter = 'erro';

		const focus = params.get('focus');
		if (focus) {
			tab = 'grupos';
			focusedGroupId = focus;
			setTimeout(() => {
				document
					.getElementById(`group-${focus}`)
					?.scrollIntoView({ block: 'center', behavior: 'smooth' });
			}, 80);
			setTimeout(() => (focusedGroupId = null), 2400);
		}

		const add = params.get('add');
		if (!add) return;
		const kind: EditorKind | null =
			add === 'link'
				? 'link'
				: add === 'app'
					? 'app'
					: add === 'source'
						? 'source'
						: add === 'group'
							? 'group'
							: add === 'filter'
								? 'filter'
								: add === 'category' || add === '1'
									? 'category'
									: null;
		if (!kind) return;

		tab =
			kind === 'source'
				? 'fontes'
				: kind === 'link' || kind === 'app'
					? 'itens'
					: kind === 'group'
						? 'grupos'
						: kind === 'category'
							? 'categorias'
							: 'filtros';
		openEditor(kind, null, {
			categoryId: params.get('category') ?? undefined,
			groupId: params.get('group') ?? undefined
		});
	});

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
		kind: 'item' | 'source' | 'category' | 'group' | 'filter',
		id: string,
		label: string
	): void {
		confirming = { kind, id, label };
	}

	async function confirmRemove(): Promise<void> {
		if (!confirming) return;
		const entry = confirming;
		confirming = null;
		await mutate({ action: `delete-${entry.kind}`, id: entry.id });
	}

	async function saveAccent(): Promise<void> {
		await mutate({ action: 'update-settings', settings: { accent } });
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
	let refreshingSourceId = $state<string | null>(null);
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

	async function refreshSource(id: string): Promise<void> {
		refreshingSourceId = id;
		refreshMessage = '';
		refreshFailed = false;

		try {
			const response = await fetch('/api/refresh', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ sourceId: id })
			});
			const result = (await response.json()) as {
				ok?: boolean;
				error?: string;
				results?: { ok: boolean; name: string }[];
			};

			if (!result.ok) {
				refreshMessage = result.error ?? 'Falha ao atualizar a fonte.';
				refreshFailed = true;
			} else {
				const failed = (result.results ?? []).filter((entry) => !entry.ok);
				refreshFailed = failed.length > 0;
				refreshMessage =
					failed.length > 0
						? `Falha em: ${failed.map((entry) => entry.name).join(', ')}`
						: 'Fonte atualizada.';
			}
			await invalidateAll();
		} catch {
			refreshMessage = 'Falha de rede ao atualizar a fonte.';
			refreshFailed = true;
		} finally {
			refreshingSourceId = null;
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
	<h1>Gerenciar</h1>
	<div class="chips">
		{#if tab === 'itens'}
			<button class="btn btn-primary" type="button" onclick={() => openEditor('link')}>
				<Icon name="plus" size={16} />
				Link
			</button>
			<button class="btn" type="button" onclick={() => openEditor('app')}>
				<Icon name="plus" size={16} />
				App
			</button>
		{:else if tab !== 'aparencia'}
			<button class="btn btn-primary" type="button" onclick={() => openEditor(addKind)}>
				<Icon name="plus" size={16} />
				{addLabel}
			</button>
		{/if}
	</div>
</div>

<div class="chips">
	<a class="btn" href={resolve('/api/export')} download>
		<Icon name="download" size={16} />
		Exportar
	</a>
	<button class="btn" type="button" onclick={() => fileInput?.click()}>
		<Icon name="upload" size={16} />
		Importar
	</button>
	<button class="btn" type="button" onclick={refreshNow} disabled={refreshing}>
		<Icon name="refresh" size={16} />
		{refreshing ? 'Atualizando...' : 'Atualizar feed'}
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

<div class="tabs" aria-label="Seções do gerenciador">
	{#each tabs as entry (entry.id)}
		<button
			class="tab"
			class:active={tab === entry.id}
			type="button"
			aria-current={tab === entry.id ? 'page' : undefined}
			onclick={() => (tab = entry.id)}
		>
			{entry.label}
		</button>
	{/each}
</div>

{#if tab === 'fontes'}
	<ManageSearch
		bind:value={sourceQuery}
		id="manage-sources"
		label="Buscar fontes"
		placeholder="Buscar fonte, alvo, grupo ou categoria"
	/>
	{#if sourceStatusFilter === 'erro'}
		<div class="chips">
			<button class="chip active" type="button" onclick={() => (sourceStatusFilter = 'all')}>
				Somente com erro ×
			</button>
		</div>
	{/if}
	<div class="manage-list">
		{#each sourceSections as section (section.category.id)}
			<div class="manage-group">
				<div class="manage-group-head">
					<span class="dot" style="background: {section.category.color}"></span>
					<span>{section.category.name}</span>
					<span class="muted small">{section.sources.length} fontes</span>
				</div>
				{#each section.sources as source (source.id)}
					{@const status = data.feed.sources[source.id]}
					<div class="manage-row source-row">
						<span
							class="item-avatar"
							style="background: {colors[source.categoryId] ?? '#8AA4FF'}22; color: {colors[
								source.categoryId
							] ?? '#8AA4FF'}"
						>
							{source.name.slice(0, 2).toUpperCase()}
						</span>
						<span class="manage-main">
							<span class="source-head">
								<span class="manage-name">{source.name}</span>
								<span class="source-status" class:error={Boolean(status?.error)}>
									{#if status?.error}
										falhou: {status.error}
									{:else if status?.lastFetchedAt}
										atualizado {relativeTime(status.lastFetchedAt)} · {status.count} posts
									{:else}
										nunca atualizada
									{/if}
								</span>
							</span>
							<span class="manage-sub">
								{source.target}
								{#if source.groupId}· {groupName[source.groupId] ?? source.groupId}{/if}
							</span>
							<span class="source-meta">
								<span class="source-chip">{typeLabels[source.type] ?? source.type}</span>
								<span class="source-chip">{catName[source.categoryId] ?? source.categoryId}</span>
								<span class="source-chip">
									{source.intervalMinutes >= 60
										? `${source.intervalMinutes / 60} h`
										: `${source.intervalMinutes} min`}
								</span>
								<span class="source-chip">{source.maxItems ?? 30} posts</span>
							</span>
						</span>
						<div class="source-actions">
							<button
								class="switch-button"
								type="button"
								role="switch"
								aria-checked={source.enabled}
								aria-label={source.enabled ? 'Desligar fonte' : 'Ligar fonte'}
								onclick={() => mutate({ action: 'toggle-source', id: source.id })}
							>
								<span class="switch" class:on={source.enabled}>
									<span class="knob"></span>
								</span>
							</button>
							<div class="manage-actions">
								<button
									class="mini-btn icon"
									type="button"
									title="Atualizar esta fonte"
									aria-label={`Atualizar ${source.name}`}
									onclick={() => refreshSource(source.id)}
									disabled={refreshingSourceId === source.id}
								>
									<Icon name="refresh" size={14} />
								</button>
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
						</div>
					</div>
				{/each}
			</div>
		{/each}
		{#if sourceSections.length === 0}
			<p class="muted">
				{hub.feedSources.length === 0 ? 'Nenhuma fonte cadastrada.' : 'Nenhuma fonte encontrada.'}
			</p>
		{/if}
	</div>
{:else if tab === 'itens'}
	<div class="chips" role="group" aria-label="Filtrar itens por tipo">
		<button
			class="chip"
			class:active={itemTypeFilter === 'todos'}
			type="button"
			aria-pressed={itemTypeFilter === 'todos'}
			onclick={() => (itemTypeFilter = 'todos')}
		>
			Todos · {hub.items.length}
		</button>
		<button
			class="chip"
			class:active={itemTypeFilter === 'link'}
			type="button"
			aria-pressed={itemTypeFilter === 'link'}
			onclick={() => (itemTypeFilter = 'link')}
		>
			Links · {linkCount}
		</button>
		<button
			class="chip"
			class:active={itemTypeFilter === 'app'}
			type="button"
			aria-pressed={itemTypeFilter === 'app'}
			onclick={() => (itemTypeFilter = 'app')}
		>
			Apps · {appCount}
		</button>
	</div>
	<ManageSearch
		bind:value={itemQuery}
		id="manage-items"
		label="Buscar itens"
		placeholder="Buscar item, grupo, categoria, URL ou tag"
	/>
	<div class="manage-list">
		{#each itemSections as section (section.category.id)}
			<div class="manage-group">
				<div class="manage-group-head">
					<span class="dot" style="background: {section.category.color}"></span>
					<span>{section.category.name}</span>
					<span class="muted small">{section.total} itens</span>
				</div>
				{#each section.groups as group (group.id)}
					<div class="manage-subgroup">
						<div class="manage-subgroup-head">
							<span>{group.name}</span>
							<span class="muted small">{group.items.length}</span>
						</div>
						{#each group.items as item (item.id)}
							<div class="manage-row">
								<ItemIcon {item} color={colors[item.categoryId] ?? '#8AA4FF'} size={34} />
								<span class="manage-main">
									<span class="manage-name">{item.name}</span>
									<span class="manage-sub">
										{itemTarget(item)}
										{#if item.description}· {item.description}{/if}
									</span>
								</span>
								<div class="manage-actions">
									<button
										class="mini-btn icon"
										type="button"
										title="Mover para cima"
										aria-label="Mover para cima"
										onclick={() => mutate({ action: 'move-item', id: item.id, direction: 'up' })}
									>
										<Icon name="chevron-up" size={14} />
									</button>
									<button
										class="mini-btn icon"
										type="button"
										title="Mover para baixo"
										aria-label="Mover para baixo"
										onclick={() => mutate({ action: 'move-item', id: item.id, direction: 'down' })}
									>
										<Icon name="chevron-down" size={14} />
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
					</div>
				{/each}
			</div>
		{/each}
		{#if itemSections.length === 0}
			<p class="muted">
				{hub.items.length === 0 ? 'Nenhum item cadastrado.' : 'Nenhum item encontrado.'}
			</p>
		{/if}
	</div>
{:else if tab === 'grupos'}
	<ManageSearch
		bind:value={groupQuery}
		id="manage-groups"
		label="Buscar grupos"
		placeholder="Buscar grupo ou categoria"
	/>
	<div class="manage-list">
		{#each groupSections as section (section.category.id)}
			<div class="manage-group">
				<div class="manage-group-head">
					<span class="dot" style="background: {section.category.color}"></span>
					<span>{section.category.name}</span>
					<span class="muted small">{section.groups.length} grupos</span>
				</div>
				{#each section.groups as group (group.id)}
					{@const itemCount = hub.items.filter((item) => item.groupId === group.id).length}
					{@const sourceCount = hub.feedSources.filter(
						(source) => source.groupId === group.id
					).length}
					<div
						class="manage-row"
						class:focused={focusedGroupId === group.id}
						id={`group-${group.id}`}
					>
						<span class="dot" style="background: {section.category.color}"></span>
						<span class="manage-main">
							<span class="manage-name">{group.name}</span>
							<span class="manage-sub">
								{itemCount}
								{itemCount === 1 ? 'item' : 'itens'} ·
								{sourceCount}
								{sourceCount === 1 ? 'fonte' : 'fontes'}
							</span>
						</span>
						<div class="manage-actions">
							<button
								class="mini-btn icon"
								type="button"
								title="Mover grupo para cima"
								aria-label="Mover grupo para cima"
								onclick={() => mutate({ action: 'move-group', id: group.id, direction: 'up' })}
							>
								<Icon name="chevron-up" size={14} />
							</button>
							<button
								class="mini-btn icon"
								type="button"
								title="Mover grupo para baixo"
								aria-label="Mover grupo para baixo"
								onclick={() => mutate({ action: 'move-group', id: group.id, direction: 'down' })}
							>
								<Icon name="chevron-down" size={14} />
							</button>
							<button class="mini-btn" type="button" onclick={() => openEditor('group', group)}>
								Editar
							</button>
							<button
								class="mini-btn danger"
								type="button"
								onclick={() => removeEntry('group', group.id, group.name)}
							>
								Remover
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/each}
		{#if groupSections.length === 0}
			<p class="muted">
				{hub.groups.length === 0
					? 'Nenhum grupo cadastrado. Crie um para reunir serviços do mesmo assunto.'
					: 'Nenhum grupo encontrado.'}
			</p>
		{/if}
	</div>
{:else if tab === 'categorias'}
	<ManageSearch
		bind:value={categoryQuery}
		id="manage-categories"
		label="Buscar categorias"
		placeholder="Buscar categoria"
	/>
	<div class="manage-list">
		{#each filteredCategories as category (category.id)}
			<div class="manage-row">
				<span class="dot" style="background: {category.color}; width: 12px; height: 12px"></span>
				<span class="manage-main">
					<span class="manage-name">{category.name}</span>
					<span class="manage-sub">
						{hub.items.filter((item) => item.categoryId === category.id).length} itens ·
						{hub.groups.filter((group) => group.categoryId === category.id).length} grupos ·
						{hub.feedSources.filter((source) => source.categoryId === category.id).length} fontes
					</span>
				</span>
				<div class="manage-actions">
					<button
						class="mini-btn icon"
						type="button"
						title="Mover categoria para cima"
						aria-label="Mover categoria para cima"
						onclick={() => mutate({ action: 'move-category', id: category.id, direction: 'up' })}
					>
						<Icon name="chevron-up" size={14} />
					</button>
					<button
						class="mini-btn icon"
						type="button"
						title="Mover categoria para baixo"
						aria-label="Mover categoria para baixo"
						onclick={() => mutate({ action: 'move-category', id: category.id, direction: 'down' })}
					>
						<Icon name="chevron-down" size={14} />
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
		{#if filteredCategories.length === 0}
			<p class="muted">
				{hub.categories.length === 0
					? 'Nenhuma categoria cadastrada.'
					: 'Nenhuma categoria encontrada.'}
			</p>
		{/if}
	</div>
{:else if tab === 'filtros'}
	<ManageSearch
		bind:value={filterQuery}
		id="manage-filters"
		label="Buscar filtros salvos"
		placeholder="Buscar filtro, incluir ou excluir"
	/>
	<div class="manage-list">
		{#each filteredFilters as filter (filter.id)}
			<div class="manage-row">
				<span class="manage-main">
					<span class="manage-name">{filter.label}</span>
					<span class="manage-sub">
						inclui: {filter.include.join(', ') || '—'} · exclui: {filter.exclude.join(', ') || '—'}
					</span>
				</span>
				<div class="manage-actions">
					<button class="mini-btn" type="button" onclick={() => openEditor('filter', filter)}>
						Editar
					</button>
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
		{#if filteredFilters.length === 0}
			<p class="muted">
				{hub.savedFilters.length === 0 ? 'Nenhum filtro salvo.' : 'Nenhum filtro encontrado.'}
			</p>
		{/if}
	</div>
{:else}
	<div class="appearance-card">
		<span class="appearance-preview" style="background: {accent}" aria-hidden="true"></span>
		<div class="appearance-main">
			<strong>Cor de destaque</strong>
			<span class="muted small">Usada em botões, links, focos e detalhes do tema.</span>
			<div class="appearance-swatches" role="group" aria-label="Cores predefinidas">
				{#each accentPresets as preset (preset)}
					<button
						class="appearance-swatch"
						class:active={accent.toLowerCase() === preset.toLowerCase()}
						type="button"
						style="background: {preset}"
						aria-label={`Usar cor ${preset}`}
						title={preset}
						onclick={() => (accent = preset)}
					></button>
				{/each}
			</div>
		</div>
		<div class="field" style="flex: 0 0 140px">
			<label for="e-accent">Cor personalizada</label>
			<input id="e-accent" type="color" bind:value={accent} />
		</div>
		<button class="btn btn-primary" type="button" onclick={saveAccent}>Salvar cor</button>
	</div>
{/if}

{#if editor}
	{#key editor.key}
		<ManageEditor
			kind={editor.kind}
			hub={data.hub}
			initial={editor.initial}
			presetCategoryId={editor.preset.categoryId}
			presetGroupId={editor.preset.groupId}
			onclose={() => (editor = null)}
		/>
	{/key}
{/if}

{#if confirming}
	<ConfirmDialog
		title={`Remover "${confirming.label}"?`}
		message="Essa ação não pode ser desfeita."
		confirmLabel="Remover"
		onconfirm={confirmRemove}
		oncancel={() => (confirming = null)}
	/>
{/if}
