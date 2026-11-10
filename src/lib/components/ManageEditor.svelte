<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import type {
		Category,
		FeedSource,
		Group,
		HubData,
		HubItem,
		SavedFilter,
		ValidationIssue
	} from '#lib/types';
	import Icon from './Icon.svelte';

	type Kind = 'link' | 'app' | 'source' | 'category' | 'group' | 'filter';

	let {
		kind,
		hub,
		initial = null,
		onclose
	}: {
		kind: Kind;
		hub: HubData;
		initial?: HubItem | FeedSource | Category | Group | SavedFilter | null;
		onclose: () => void;
	} = $props();

	const isEdit = untrack(() => initial !== null);

	interface Seed {
		name: string;
		url: string;
		launchValue: string;
		icon: string;
		categoryId: string;
		groupId: string;
		tags: string;
		pinned: boolean;
		sourceType: FeedSource['type'];
		target: string;
		intervalMinutes: number;
		enabled: boolean;
		include: string;
		exclude: string;
		matchMode: 'any' | 'all';
		color: string;
		filterLabel: string;
		filterInclude: string;
		filterExclude: string;
	}

	function buildSeed(
		source: HubItem | FeedSource | Category | Group | SavedFilter | null,
		data: HubData
	): Seed {
		const isFeedSource =
			source !== null &&
			'type' in source &&
			(source.type === 'rss' || source.type === 'youtube' || source.type === 'reddit');
		const feedSource = isFeedSource ? (source as FeedSource) : null;
		const item = source !== null && 'type' in source && !isFeedSource ? (source as HubItem) : null;

		return {
			name: (source && 'name' in source ? source.name : '') || '',
			url: item?.type === 'link' ? item.url : '',
			launchValue: item?.type === 'app' ? item.launch.value : '',
			icon: item?.icon ?? '',
			categoryId:
				(source && 'categoryId' in source ? source.categoryId : data.categories[0]?.id) ?? '',
			groupId: (source && 'groupId' in source ? source.groupId : '') ?? '',
			tags: item ? item.tags.join(', ') : '',
			pinned: item?.pinned ?? false,
			sourceType: feedSource?.type ?? 'rss',
			target: feedSource?.target ?? '',
			intervalMinutes: feedSource?.intervalMinutes ?? 30,
			enabled: feedSource?.enabled ?? true,
			include: (feedSource?.include ?? []).join(', '),
			exclude: (feedSource?.exclude ?? []).join(', '),
			matchMode: feedSource?.matchMode ?? 'any',
			color: source && 'color' in source ? source.color : '#8AA4FF',
			filterLabel: source && 'label' in source ? source.label : '',
			filterInclude: source && 'include' in source ? source.include.join(', ') : '',
			filterExclude: source && 'exclude' in source ? source.exclude.join(', ') : ''
		};
	}

	const seed = untrack(() => buildSeed(initial, hub));

	let name = $state(seed.name);
	let url = $state(seed.url);
	let launchValue = $state(seed.launchValue);
	let icon = $state(seed.icon);
	let categoryId = $state(seed.categoryId);
	let groupId = $state(seed.groupId);
	let tags = $state(seed.tags);
	let pinned = $state(seed.pinned);

	let sourceType = $state<FeedSource['type']>(seed.sourceType);
	let target = $state(seed.target);
	let intervalMinutes = $state(seed.intervalMinutes);
	let enabled = $state(seed.enabled);
	let include = $state(seed.include);
	let exclude = $state(seed.exclude);
	let matchMode = $state<'any' | 'all'>(seed.matchMode);

	let color = $state(seed.color);
	let filterLabel = $state(seed.filterLabel);
	let filterInclude = $state(seed.filterInclude);
	let filterExclude = $state(seed.filterExclude);

	let busy = $state(false);
	let error = $state('');
	let issues = $state<ValidationIssue[]>([]);
	let notice = $state('');
	let detecting = $state(false);
	let dialogEl = $state<HTMLDialogElement | null>(null);

	const groups = $derived(hub.groups.filter((group) => group.categoryId === categoryId));
	const kindLabel = $derived(
		kind === 'source'
			? 'fonte'
			: kind === 'link'
				? 'link'
				: kind === 'app'
					? 'app'
					: kind === 'category'
						? 'categoria'
						: kind === 'group'
							? 'grupo'
							: 'filtro'
	);
	const title = $derived(`${isEdit ? 'Editar' : 'Adicionar'} ${kindLabel}`);

	onMount(() => {
		dialogEl?.showModal();
		const field = dialogEl?.querySelector<HTMLElement>('input:not([type="hidden"]), select');
		(field ?? dialogEl)?.focus();
	});

	onDestroy(() => {
		dialogEl?.close();
	});

	function handleCancel(event: Event): void {
		event.preventDefault();
		onclose();
	}

	function handleBackdropClick(event: MouseEvent): void {
		if (event.target === dialogEl) onclose();
	}

	function onCategoryChange(): void {
		if (
			groupId &&
			!hub.groups.some((group) => group.id === groupId && group.categoryId === categoryId)
		) {
			groupId = '';
		}
	}

	function parseList(value: string): string[] {
		return value
			.split(',')
			.map((entry) => entry.trim())
			.filter(Boolean);
	}

	async function detectFeed(): Promise<void> {
		detecting = true;
		error = '';
		issues = [];
		notice = '';

		try {
			const response = await fetch('/api/discover-feed', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ url: target })
			});
			const result = (await response.json()) as { ok?: boolean; feedUrl?: string; error?: string };

			if (!result.ok || !result.feedUrl) {
				error = result.error ?? 'Nenhum feed encontrado.';
				return;
			}

			target = result.feedUrl;
			if (!name) name = new URL(result.feedUrl).hostname;
			notice = 'Feed detectado automaticamente.';
		} catch {
			error = 'Falha de rede ao detectar o feed.';
		} finally {
			detecting = false;
		}
	}

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		busy = true;
		error = '';
		issues = [];
		notice = '';

		let payload: Record<string, unknown>;

		if (kind === 'link' || kind === 'app') {
			const base = {
				name,
				categoryId,
				...(groupId ? { groupId } : {}),
				...(icon.trim() ? { icon: icon.trim() } : {}),
				tags: parseList(tags),
				pinned
			};
			const item =
				kind === 'link' ? { ...base, type: 'link', url } : { ...base, type: 'app', launchValue };

			payload = isEdit
				? {
						action: 'update-item',
						id: (initial as HubItem).id,
						patch: {
							...base,
							groupId: groupId || null,
							icon: icon.trim() || null,
							...(kind === 'link' ? { url } : { launchValue })
						}
					}
				: { action: 'add-item', item };
		} else if (kind === 'source') {
			const sourceBase = {
				type: sourceType,
				name,
				target,
				categoryId,
				intervalMinutes,
				enabled,
				include: parseList(include),
				exclude: parseList(exclude),
				matchMode
			};
			payload = isEdit
				? {
						action: 'update-source',
						id: (initial as FeedSource).id,
						sourcePatch: { ...sourceBase, groupId: groupId || null }
					}
				: {
						action: 'add-source',
						source: { ...sourceBase, ...(groupId ? { groupId } : {}) }
					};
		} else if (kind === 'category') {
			payload = isEdit
				? {
						action: 'update-category',
						id: (initial as Category).id,
						category: { name, color }
					}
				: { action: 'add-category', category: { name, color } };
		} else if (kind === 'group') {
			payload = isEdit
				? {
						action: 'update-group',
						id: (initial as Group).id,
						groupPatch: { name, categoryId }
					}
				: { action: 'add-group', group: { name, categoryId } };
		} else {
			const filter = {
				label: filterLabel,
				include: parseList(filterInclude),
				exclude: parseList(filterExclude),
				matchMode
			};
			payload = isEdit
				? { action: 'update-filter', id: (initial as SavedFilter).id, filter }
				: { action: 'add-filter', filter };
		}

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
				error = result.error ?? 'Não foi possível salvar.';
				issues = result.issues ?? [];
				return;
			}

			await invalidateAll();
			onclose();
		} catch {
			error = 'Falha de rede ao salvar.';
		} finally {
			busy = false;
		}
	}
</script>

<dialog
	bind:this={dialogEl}
	class="editor-panel"
	aria-label={title}
	tabindex="-1"
	oncancel={handleCancel}
	onclick={handleBackdropClick}
>
	<div class="editor-head">
		<h2>{title}</h2>
		<button type="button" class="palette-close" aria-label="Fechar painel" onclick={onclose}>
			<Icon name="x" size={16} />
		</button>
	</div>

	<form class="editor-form" onsubmit={submit}>
		{#if kind === 'link' || kind === 'app'}
			<div class="field">
				<label for="e-name">Nome</label>
				<input id="e-name" bind:value={name} required maxlength="120" />
			</div>

			{#if kind === 'link'}
				<div class="field">
					<label for="e-url">URL</label>
					<input id="e-url" type="url" bind:value={url} required placeholder="https://..." />
				</div>
			{:else}
				<div class="field">
					<label for="e-launch">Protocolo / comando</label>
					<input id="e-launch" bind:value={launchValue} required placeholder="steam://run/..." />
					<span class="muted small">Ex.: steam://, discord://, vscode://, obsidian://</span>
				</div>
			{/if}

			<div class="field">
				<label for="e-icon">Ícone (opcional)</label>
				<input id="e-icon" bind:value={icon} placeholder="github ou https://..." />
				<span class="muted small">
					Slug do Simple Icons (ex.: <code>steam</code>) ou URL de uma imagem. Vazio usa o favicon
					(links) ou o ícone do protocolo (apps).
				</span>
			</div>

			<div class="editor-row">
				<div class="field">
					<label for="e-cat">Categoria</label>
					<select id="e-cat" bind:value={categoryId} onchange={onCategoryChange} required>
						{#each hub.categories as category (category.id)}
							<option value={category.id}>{category.name}</option>
						{/each}
					</select>
				</div>
				<div class="field">
					<label for="e-group">Grupo</label>
					<select id="e-group" bind:value={groupId}>
						<option value="">Sem grupo</option>
						{#each groups as group (group.id)}
							<option value={group.id}>{group.name}</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="field">
				<label for="e-tags">Tags (separadas por vírgula)</label>
				<input id="e-tags" bind:value={tags} placeholder="build, wiki" />
			</div>

			<label class="check">
				<input type="checkbox" bind:checked={pinned} />
				Fixar no acesso rápido da home
			</label>
		{:else if kind === 'source'}
			<div class="field">
				<label for="e-source-type">Tipo de fonte</label>
				<select id="e-source-type" bind:value={sourceType}>
					<option value="rss">RSS / Atom</option>
					<option value="youtube">YouTube</option>
					<option value="reddit">Reddit</option>
				</select>
			</div>

			<div class="field">
				<label for="e-target">
					{sourceType === 'reddit'
						? 'Subreddit ou URL do .rss'
						: sourceType === 'youtube'
							? 'ID do canal (UC...) ou URL do feed'
							: 'URL do feed ou da página'}
				</label>
				<div class="field-inline">
					<input
						id="e-target"
						bind:value={target}
						required
						placeholder={sourceType === 'reddit'
							? 'Darktide'
							: sourceType === 'youtube'
								? 'UC...'
								: 'https://exemplo.com/feed.xml'}
					/>
					{#if sourceType === 'rss'}
						<button type="button" class="btn" onclick={detectFeed} disabled={detecting || !target}>
							{detecting ? 'Detectando...' : 'Detectar'}
						</button>
					{/if}
				</div>
			</div>

			<div class="field">
				<label for="e-source-name">Nome de exibição</label>
				<input id="e-source-name" bind:value={name} required maxlength="120" />
			</div>

			<div class="editor-row">
				<div class="field">
					<label for="e-source-cat">Categoria</label>
					<select id="e-source-cat" bind:value={categoryId} onchange={onCategoryChange} required>
						{#each hub.categories as category (category.id)}
							<option value={category.id}>{category.name}</option>
						{/each}
					</select>
				</div>
				<div class="field">
					<label for="e-source-group">Grupo</label>
					<select id="e-source-group" bind:value={groupId}>
						<option value="">Sem grupo</option>
						{#each groups as group (group.id)}
							<option value={group.id}>{group.name}</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="editor-row">
				<div class="field">
					<label for="e-interval">Atualizar a cada</label>
					<select id="e-interval" bind:value={intervalMinutes}>
						<option value={15}>15 minutos</option>
						<option value={30}>30 minutos</option>
						<option value={60}>1 hora</option>
						<option value={360}>6 horas</option>
						<option value={1440}>24 horas</option>
					</select>
				</div>
				<div class="field">
					<label for="e-mode">Regra</label>
					<select id="e-mode" bind:value={matchMode}>
						<option value="any">Qualquer palavra</option>
						<option value="all">Todas as palavras</option>
					</select>
				</div>
			</div>

			<div class="editor-row">
				<div class="field">
					<label for="e-include">Destacar se contiver</label>
					<input id="e-include" bind:value={include} placeholder="patch, hotfix" />
				</div>
				<div class="field">
					<label for="e-exclude">Silenciar se contiver</label>
					<input id="e-exclude" bind:value={exclude} placeholder="promoção" />
				</div>
			</div>

			<label class="check">
				<input type="checkbox" bind:checked={enabled} />
				Mostrar no feed da página inicial
			</label>
		{:else if kind === 'category'}
			<div class="field">
				<label for="e-cat-name">Nome da categoria</label>
				<input id="e-cat-name" bind:value={name} required maxlength="80" />
			</div>
			<div class="field">
				<label for="e-cat-color">Cor</label>
				<input id="e-cat-color" type="color" bind:value={color} />
			</div>
		{:else if kind === 'group'}
			<div class="field">
				<label for="e-group-name">Nome do grupo</label>
				<input id="e-group-name" bind:value={name} required maxlength="80" />
			</div>
			<div class="field">
				<label for="e-group-cat">Categoria</label>
				<select id="e-group-cat" bind:value={categoryId} required>
					{#each hub.categories as category (category.id)}
						<option value={category.id}>{category.name}</option>
					{/each}
				</select>
			</div>
		{:else}
			<div class="field">
				<label for="e-filter-label">Rótulo do filtro</label>
				<input id="e-filter-label" bind:value={filterLabel} required placeholder="patch" />
			</div>
			<div class="editor-row">
				<div class="field">
					<label for="e-filter-include">Incluir</label>
					<input id="e-filter-include" bind:value={filterInclude} placeholder="patch, hotfix" />
				</div>
				<div class="field">
					<label for="e-filter-exclude">Excluir</label>
					<input id="e-filter-exclude" bind:value={filterExclude} placeholder="promoção" />
				</div>
			</div>
			<div class="field">
				<label for="e-filter-mode">Modo</label>
				<select id="e-filter-mode" bind:value={matchMode}>
					<option value="any">Qualquer palavra</option>
					<option value="all">Todas as palavras</option>
				</select>
			</div>
		{/if}

		{#if notice}
			<div class="notice" role="status">{notice}</div>
		{/if}

		{#if error}
			<div class="alert" role="alert">
				<strong>{error}</strong>
				{#if issues.length > 0}
					<ul>
						{#each issues.slice(0, 6) as issue, index (index)}
							<li>
								<code>{issue.path.length ? issue.path.join(' › ') : 'arquivo'}</code>: {issue.message}
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/if}

		<div class="editor-actions">
			<button class="btn" type="button" onclick={onclose} disabled={busy}>Cancelar</button>
			<button class="btn btn-primary" type="submit" disabled={busy}>
				{busy ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Adicionar'}
			</button>
		</div>
	</form>
</dialog>
