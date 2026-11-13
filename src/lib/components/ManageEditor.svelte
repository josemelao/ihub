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
	import {
		registerBackdropPointerDown,
		resetBackdropPointer,
		shouldCloseOnBackdropClick,
		type BackdropPointerState
	} from '#lib/dialog-backdrop';
	import { sortFeedSourcesForDisplay } from '#lib/feed/order';
	import { collectTags } from '#lib/tags';
	import Icon from './Icon.svelte';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import ItemIcon from './ItemIcon.svelte';

	type Kind = 'link' | 'app' | 'source' | 'category' | 'group' | 'filter';

	let {
		kind,
		hub,
		initial = null,
		presetCategoryId,
		presetGroupId,
		presetUrl,
		presetName,
		presetDescription,
		presetIcon,
		onclose
	}: {
		kind: Kind;
		hub: HubData;
		initial?: HubItem | FeedSource | Category | Group | SavedFilter | null;
		presetCategoryId?: string;
		presetGroupId?: string;
		presetUrl?: string;
		presetName?: string;
		presetDescription?: string;
		presetIcon?: string;
		onclose: () => void;
	} = $props();

	const isEdit = untrack(() => initial !== null);

	interface Seed {
		name: string;
		description: string;
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
		maxItems: number;
		fullText: boolean;
		enabled: boolean;
		include: string;
		exclude: string;
		matchMode: 'any' | 'all';
		color: string;
		filterLabel: string;
		filterInclude: string;
		filterExclude: string;
		filterCategoryId: string;
		filterSourceId: string;
		filterUnreadOnly: boolean;
	}

	function buildSeed(
		source: HubItem | FeedSource | Category | Group | SavedFilter | null,
		data: HubData,
		presetCategoryId?: string,
		presetGroupId?: string,
		presetUrl?: string,
		presetName?: string,
		presetDescription?: string,
		presetIcon?: string
	): Seed {
		const isFeedSource =
			source !== null &&
			'type' in source &&
			(source.type === 'rss' || source.type === 'youtube' || source.type === 'reddit');
		const feedSource = isFeedSource ? (source as FeedSource) : null;
		const item = source !== null && 'type' in source && !isFeedSource ? (source as HubItem) : null;
		const presetCategory =
			presetCategoryId && data.categories.some((category) => category.id === presetCategoryId)
				? presetCategoryId
				: undefined;
		const categoryId =
			(source && 'categoryId' in source ? source.categoryId : presetCategory) ??
			data.categories[0]?.id ??
			'';
		const presetGroup =
			presetGroupId &&
			data.groups.some((group) => group.id === presetGroupId && group.categoryId === categoryId)
				? presetGroupId
				: '';

		return {
			name: (source && 'name' in source ? source.name : '') || presetName || '',
			description: item?.description ?? presetDescription ?? '',
			url: item?.type === 'link' ? item.url : (presetUrl ?? ''),
			launchValue: item?.type === 'app' ? item.launch.value : '',
			icon: item?.icon ?? presetIcon ?? '',
			categoryId,
			groupId: (source && 'groupId' in source ? source.groupId : presetGroup) ?? '',
			tags: item ? item.tags.join(', ') : '',
			pinned: source && 'pinned' in source ? Boolean(source.pinned) : false,
			sourceType: feedSource?.type ?? 'rss',
			target: feedSource?.target ?? '',
			intervalMinutes: feedSource?.intervalMinutes ?? 30,
			maxItems: feedSource?.maxItems ?? 30,
			fullText: feedSource?.fullText ?? false,
			enabled: feedSource?.enabled ?? true,
			include: (feedSource?.include ?? []).join(', '),
			exclude: (feedSource?.exclude ?? []).join(', '),
			matchMode: feedSource?.matchMode ?? 'any',
			color: source && 'color' in source ? source.color : '#8AA4FF',
			filterLabel: source && 'label' in source ? source.label : '',
			filterInclude: source && 'include' in source ? source.include.join(', ') : '',
			filterExclude: source && 'exclude' in source ? source.exclude.join(', ') : '',
			filterCategoryId:
				source && 'label' in source ? ((source as SavedFilter).categoryId ?? '') : '',
			filterSourceId: source && 'label' in source ? ((source as SavedFilter).sourceId ?? '') : '',
			filterUnreadOnly:
				source && 'label' in source ? Boolean((source as SavedFilter).unreadOnly) : false
		};
	}

	const seed = untrack(() =>
		buildSeed(
			initial,
			hub,
			presetCategoryId,
			presetGroupId,
			presetUrl,
			presetName,
			presetDescription,
			presetIcon
		)
	);

	let name = $state(seed.name);
	let description = $state(seed.description);
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
	let maxItems = $state(seed.maxItems);
	let fullText = $state(seed.fullText);
	let enabled = $state(seed.enabled);
	let include = $state(seed.include);
	let exclude = $state(seed.exclude);
	let matchMode = $state<'any' | 'all'>(seed.matchMode);

	let color = $state(seed.color);
	let filterLabel = $state(seed.filterLabel);
	let filterInclude = $state(seed.filterInclude);
	let filterExclude = $state(seed.filterExclude);
	let filterCategoryId = $state(seed.filterCategoryId);
	let filterSourceId = $state(seed.filterSourceId);
	let filterUnreadOnly = $state(seed.filterUnreadOnly);

	let confirmDiscard = $state(false);

	function currentValues() {
		return {
			name,
			description,
			url,
			launchValue,
			icon,
			categoryId,
			groupId,
			tags,
			pinned,
			sourceType,
			target,
			intervalMinutes,
			maxItems,
			fullText,
			enabled,
			include,
			exclude,
			matchMode,
			color,
			filterLabel,
			filterInclude,
			filterExclude
		};
	}

	const initialValues = untrack(() => currentValues());
	const dirty = $derived(JSON.stringify(currentValues()) !== JSON.stringify(initialValues));

	let busy = $state(false);
	let error = $state('');
	let issues = $state<ValidationIssue[]>([]);
	let notice = $state('');
	let detecting = $state(false);
	let testing = $state(false);
	let testResult = $state('');
	let testFailed = $state(false);
	let dialogEl = $state<HTMLDialogElement | null>(null);
	const backdropState: BackdropPointerState = { pointerDownOnBackdrop: false };

	const groups = $derived(hub.groups.filter((group) => group.categoryId === categoryId));
	const availableTags = $derived(collectTags(hub).map((tag) => tag.tag));
	const currentColor = $derived(
		hub.categories.find((category) => category.id === categoryId)?.color ?? '#8AA4FF'
	);
	const previewItem = $derived.by((): HubItem => {
		const base = {
			id: 'preview',
			name: name || (kind === 'app' ? 'App' : 'Link'),
			...(description.trim() ? { description: description.trim() } : {}),
			categoryId,
			tags: [] as string[],
			pinned: false,
			order: 0,
			...(icon.trim() ? { icon: icon.trim() } : {})
		};

		return kind === 'link'
			? { ...base, type: 'link', url }
			: { ...base, type: 'app', launch: { kind: 'protocol', value: launchValue } };
	});
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

	function requestClose(): void {
		if (dirty) {
			confirmDiscard = true;
			return;
		}
		onclose();
	}

	function discardAndClose(): void {
		confirmDiscard = false;
		onclose();
	}

	function handleCancel(event: Event): void {
		event.preventDefault();
		requestClose();
	}

	function handleBackdropClick(event: MouseEvent): void {
		if (shouldCloseOnBackdropClick(backdropState, event.target, dialogEl)) requestClose();
	}

	function handlePointerDown(event: PointerEvent): void {
		registerBackdropPointerDown(backdropState, event.target, dialogEl);
	}

	function handlePointerCancel(): void {
		resetBackdropPointer(backdropState);
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

		const original = target.trim();
		let lookup = original;
		if (
			sourceType === 'youtube' &&
			lookup &&
			!/^https?:\/\//i.test(lookup) &&
			!lookup.startsWith('@') &&
			!/^(www\.)?youtube\.com\//i.test(lookup) &&
			!/^UC[\w-]{20,}$/.test(lookup)
		) {
			lookup = `@${lookup}`;
		}

		try {
			const response = await fetch('/api/discover-feed', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ url: lookup })
			});
			const result = (await response.json()) as { ok?: boolean; feedUrl?: string; error?: string };

			if (!result.ok || !result.feedUrl) {
				error = result.error ?? 'Nenhum feed encontrado.';
				return;
			}

			target = result.feedUrl;
			if (!name) {
				if (sourceType === 'youtube') {
					const handle = original.match(/@([^/?#]+)/)?.[1] ?? original.replace(/^@/, '');
					name = handle && !/^UC[\w-]{20,}$/.test(handle) ? `YouTube · @${handle}` : 'YouTube';
				} else {
					name = new URL(result.feedUrl).hostname;
				}
			}
			notice = 'Feed detectado automaticamente.';
		} catch {
			error = 'Falha de rede ao detectar o feed.';
		} finally {
			detecting = false;
		}
	}

	function splitTerms(value: string): string[] {
		return value
			.split(',')
			.map((term) => term.trim())
			.filter(Boolean);
	}

	async function testSource(): Promise<void> {
		testing = true;
		testResult = '';
		testFailed = false;

		try {
			const response = await fetch('/api/test-source', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					type: sourceType,
					target,
					include: splitTerms(include),
					exclude: splitTerms(exclude),
					matchMode
				})
			});
			const result = (await response.json()) as {
				ok?: boolean;
				total?: number;
				filtered?: number;
				titles?: string[];
				error?: string;
			};

			if (!response.ok || !result.ok) {
				testFailed = true;
				testResult = result.error ?? 'Falha ao testar a fonte.';
				return;
			}

			const titles = (result.titles ?? []).join(' · ');
			testResult = `${result.total} posts encontrados; ${result.filtered} passam nas regras.${titles ? ` Primeiros: ${titles}` : ''}`;
		} catch {
			testFailed = true;
			testResult = 'Falha de rede ao testar a fonte.';
		} finally {
			testing = false;
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
				...(description.trim() ? { description: description.trim() } : {}),
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
							description: description.trim() || null,
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
				maxItems,
				fullText,
				enabled,
				include: parseList(include),
				exclude: parseList(exclude),
				matchMode
			};
			payload = isEdit
				? {
						action: 'update-source',
						id: (initial as FeedSource).id,
						sourcePatch: {
							...sourceBase,
							groupId: groupId || null,
							locale: null
						}
					}
				: {
						action: 'add-source',
						source: {
							...sourceBase,
							...(groupId ? { groupId } : {})
						}
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
						groupPatch: { name, categoryId, pinned }
					}
				: { action: 'add-group', group: { name, categoryId, pinned } };
		} else {
			const filter = {
				label: filterLabel,
				include: parseList(filterInclude),
				exclude: parseList(filterExclude),
				matchMode,
				categoryId: filterCategoryId || null,
				sourceId: filterSourceId || null,
				unreadOnly: filterUnreadOnly
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
	onpointerdown={handlePointerDown}
	onpointercancel={handlePointerCancel}
>
	<div class="editor-head">
		<h2>{title}</h2>
		<button type="button" class="palette-close" aria-label="Fechar painel" onclick={requestClose}>
			<Icon name="x" size={16} />
		</button>
	</div>

	<form class="editor-form" onsubmit={submit}>
		<div class="editor-body">
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
					<label for="e-description">Descrição curta (opcional)</label>
					<textarea
						id="e-description"
						bind:value={description}
						maxlength="280"
						rows="2"
						placeholder="Uma nota curta para lembrar para que serve"></textarea>
				</div>

				<div class="editor-section">
					<span class="editor-section-label">Organização</span>
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
				</div>

				<div class="editor-section">
					<span class="editor-section-label">Aparência</span>
					<div class="field">
						<label for="e-icon">Ícone (opcional)</label>
						<div class="field-inline">
							<ItemIcon item={previewItem} color={currentColor} size={38} />
							<input id="e-icon" bind:value={icon} placeholder="github ou https://..." />
						</div>
						<span class="muted small">
							Slug do Simple Icons (ex.: <code>steam</code>) ou URL de uma imagem. Vazio usa o
							favicon (links) ou o ícone do protocolo (apps).
						</span>
					</div>
				</div>

				<div class="editor-section">
					<span class="editor-section-label">Extras</span>
					<div class="field">
						<label for="e-tags">Tags (separadas por vírgula)</label>
						<input id="e-tags" bind:value={tags} placeholder="build, wiki" list="e-tags-options" />
						<datalist id="e-tags-options">
							{#each availableTags as tag (tag)}
								<option value={tag}></option>
							{/each}
						</datalist>
					</div>

					<label class="check">
						<input type="checkbox" bind:checked={pinned} />
						Fixar no acesso rápido da home
					</label>
				</div>
			{:else if kind === 'source'}
				<div class="editor-section">
					<span class="editor-section-label">Fonte</span>
					<div class="field">
						<label for="e-source-type">Tipo de fonte</label>
						<select id="e-source-type" bind:value={sourceType}>
							<option value="rss">RSS / Atom</option>
							<option value="youtube">YouTube</option>
							<option value="reddit">Reddit</option>
						</select>
					</div>

					{#if sourceType === 'reddit'}
						<span class="muted small">
							O embed do Reddit abre no idioma do seu navegador/conta.
						</span>
					{/if}

					<div class="field">
						<label for="e-target">
							{sourceType === 'reddit'
								? 'Subreddit ou URL do .rss'
								: sourceType === 'youtube'
									? 'Canal (@handle, ID UC... ou URL do feed)'
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
										? '@canal ou UC...'
										: 'https://exemplo.com/feed.xml'}
							/>
							{#if sourceType === 'rss' || sourceType === 'youtube'}
								<button
									type="button"
									class="btn"
									onclick={detectFeed}
									disabled={detecting || !target}
								>
									{detecting ? 'Detectando...' : 'Detectar'}
								</button>
							{/if}
							<button type="button" class="btn" onclick={testSource} disabled={testing || !target}>
								{testing ? 'Testando...' : 'Testar'}
							</button>
						</div>
						{#if testResult}
							<span class="muted small" class:error-text={testFailed} role="status">
								{testResult}
							</span>
						{/if}
						{#if sourceType === 'youtube'}
							<span class="muted small">
								Ex.: @MisterEtide, https://youtube.com/@canal ou UCy7DyzEEC9h81lmwg6H5rlw
							</span>
						{/if}
					</div>

					<div class="field">
						<label for="e-source-name">Nome de exibição</label>
						<input id="e-source-name" bind:value={name} required maxlength="120" />
					</div>
				</div>

				<div class="editor-section">
					<span class="editor-section-label">Organização</span>
					<div class="editor-row">
						<div class="field">
							<label for="e-source-cat">Categoria</label>
							<select
								id="e-source-cat"
								bind:value={categoryId}
								onchange={onCategoryChange}
								required
							>
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
				</div>

				<div class="editor-section">
					<span class="editor-section-label">Atualização</span>
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
							<label for="e-max-items">Limite de posts</label>
							<select id="e-max-items" bind:value={maxItems}>
								<option value={10}>10 posts</option>
								<option value={20}>20 posts</option>
								<option value={30}>30 posts</option>
								<option value={50}>50 posts</option>
								<option value={100}>100 posts</option>
							</select>
						</div>
					</div>
				</div>

				{#if sourceType === 'rss'}
					<div class="editor-section">
						<span class="editor-section-label">Leitura</span>
						<label class="check">
							<input type="checkbox" bind:checked={fullText} />
							Buscar texto completo (reader)
						</label>
						<span class="muted small">
							Extrai o texto da página ao abrir o reader; fica salvo localmente.
						</span>
					</div>
				{/if}

				<div class="editor-section">
					<span class="editor-section-label">Filtros</span>
					<div class="editor-row">
						<div class="field">
							<label for="e-include">Mostrar somente se contiver</label>
							<input id="e-include" bind:value={include} placeholder="patch, hotfix" />
						</div>
						<div class="field">
							<label for="e-exclude">Ocultar se contiver</label>
							<input id="e-exclude" bind:value={exclude} placeholder="promoção" />
						</div>
					</div>

					<span class="muted small">Aplica um filtro na exibição; não altera o cache.</span>

					<div class="field">
						<label for="e-mode">Regra</label>
						<select id="e-mode" bind:value={matchMode}>
							<option value="any">Qualquer palavra</option>
							<option value="all">Todas as palavras</option>
						</select>
					</div>

					<label class="check">
						<input type="checkbox" bind:checked={enabled} />
						Mostrar no feed da página inicial
					</label>
				</div>
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
				<div class="editor-section">
					<span class="editor-section-label">Acesso rápido</span>
					<label class="check">
						<input type="checkbox" bind:checked={pinned} />
						Fixar no acesso rápido da home
					</label>
					<span class="muted small"> O atalho abre a Biblioteca já focada neste grupo. </span>
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
				<div class="editor-row">
					<div class="field">
						<label for="e-filter-category">Categoria</label>
						<select
							id="e-filter-category"
							bind:value={filterCategoryId}
							onchange={() => {
								const valid =
									!filterSourceId ||
									hub.feedSources.some(
										(source) =>
											source.id === filterSourceId &&
											(!filterCategoryId || source.categoryId === filterCategoryId)
									);
								if (!valid) filterSourceId = '';
							}}
						>
							<option value="">Todas</option>
							{#each [...hub.categories].sort((a, b) => a.order - b.order) as category (category.id)}
								<option value={category.id}>{category.name}</option>
							{/each}
						</select>
					</div>
					<div class="field">
						<label for="e-filter-source">Fonte</label>
						<select id="e-filter-source" bind:value={filterSourceId}>
							<option value="">Todas</option>
							{#each sortFeedSourcesForDisplay( hub.feedSources.filter((source) => !filterCategoryId || source.categoryId === filterCategoryId), hub.categories ) as source (source.id)}
								<option value={source.id}>{source.name}</option>
							{/each}
						</select>
					</div>
				</div>
				<label class="check">
					<input type="checkbox" bind:checked={filterUnreadOnly} />
					Somente não lidos
				</label>
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
		</div>

		<div class="editor-actions">
			<button class="btn" type="button" onclick={requestClose} disabled={busy}>Cancelar</button>
			<button class="btn btn-primary" type="submit" disabled={busy}>
				{busy ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Adicionar'}
			</button>
		</div>
	</form>
</dialog>

{#if confirmDiscard}
	<ConfirmDialog
		title="Descartar alterações?"
		message="As alterações não salvas serão perdidas."
		confirmLabel="Descartar"
		cancelLabel="Continuar editando"
		onconfirm={discardAndClose}
		oncancel={() => (confirmDiscard = false)}
	/>
{/if}
