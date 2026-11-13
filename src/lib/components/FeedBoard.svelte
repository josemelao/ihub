<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { flip } from 'svelte/animate';
	import { onMount, untrack } from 'svelte';
	import { fade } from 'svelte/transition';
	import { masonry } from '#lib/actions/masonry';
	import { readLocal, writeLocal } from '#lib/browser-storage';
	import { countActiveFeedFilters, shouldOpenFeedFilters } from '#lib/feed/filter-bar';
	import { matchesFilter } from '#lib/feed/filter';
	import { selectAll, updateSelection } from '#lib/feed/selection';
	import { countUnread, cutoffDaysAgo, idsOlderThan, resolveScope } from '#lib/feed/triage';
	import type { FeedViewItem } from '#lib/feed/view';
	import { canOpenEntry, snapshotFromEntry } from '#lib/feed/view';
	import type { Category, FeedSource, SavedFilter } from '#lib/types';
	import { refreshWithProgress } from '#lib/refresh-client';
	import { clearUndoBatch, loadUndoBatch, saveUndoBatch } from '#lib/undo';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import FeedCard from './FeedCard.svelte';
	import Icon from './Icon.svelte';
	import SavedContentSearch from './SavedContentSearch.svelte';
	import ShortcutHelp from './ShortcutHelp.svelte';

	type FeedView = 'bento' | 'compact' | 'completo';

	let {
		entries,
		savedFilters = [],
		categories = [],
		sources = [],
		title,
		showCategoryChips = false,
		contextNote = '',
		emptyTitle = '',
		emptyHint = '',
		overview = false,
		saved = false,
		initialFilterId = null,
		initialSourceId = null,
		initialUnreadOnly = false
	}: {
		entries: FeedViewItem[];
		savedFilters?: SavedFilter[];
		categories?: Category[];
		sources?: FeedSource[];
		title: string;
		showCategoryChips?: boolean;
		contextNote?: string;
		emptyTitle?: string;
		emptyHint?: string;
		overview?: boolean;
		saved?: boolean;
		initialFilterId?: string | null;
		initialSourceId?: string | null;
		initialUnreadOnly?: boolean;
	} = $props();

	const viewOptions: { id: FeedView; label: string }[] = [
		{ id: 'bento', label: 'Bento' },
		{ id: 'compact', label: 'Compacto' },
		{ id: 'completo', label: 'Completo' }
	];

	let view = $state<FeedView>('bento');
	let query = $state('');
	let modeChoice = $state<'any' | 'all'>('any');
	let activeFilterId = $state<string | null>(untrack(() => initialFilterId));
	let lastInitialFilterId = untrack(() => initialFilterId);
	let unreadOnly = $state(untrack(() => initialUnreadOnly));
	let lastInitialUnreadOnly = untrack(() => initialUnreadOnly);
	let categoryFilter = $state('all');
	let sourceFilter = $state<string>(untrack(() => initialSourceId ?? 'all'));
	let lastInitialSourceId = untrack(() => initialSourceId);
	let savedQuery = $state('');
	let savedSort = $state<'saved' | 'published'>('saved');
	let savedMode = $state<'title' | 'content'>('title');
	let filtersOpen = $state(
		untrack(() =>
			shouldOpenFeedFilters({
				activeFilterId: initialFilterId,
				sourceId: initialSourceId,
				unreadOnly: initialUnreadOnly
			})
		)
	);
	let limit = $state(10);
	let refreshing = $state(false);
	let refreshMessage = $state('');
	let refreshProgress = $state<{ done: number; total: number } | null>(null);
	let refreshFailed = $state(false);
	let confirmMarkAll = $state(false);
	let pendingMarkAllIds = $state<string[]>([]);
	let undoIds = $state<string[]>([]);
	let undoBusy = $state(false);
	let toastMessage = $state('');
	let toastKind = $state<'undo' | 'success' | 'error' | ''>('');
	let undoTimer: ReturnType<typeof setTimeout> | undefined;
	let toastTimer: ReturnType<typeof setTimeout> | undefined;
	let reduceMotion = $state(false);
	let viewReady = $state(false);
	let animationsEnabled = $state(false);
	let viewMotionReady = $state(false);
	let viewTimer: ReturnType<typeof setTimeout> | undefined;
	let showFilterForm = $state(false);
	let filterLabel = $state('');
	let filterInclude = $state('');
	let filterExclude = $state('');
	let filterMode = $state<'any' | 'all'>('any');
	let filterCategory = $state('all');
	let filterSource = $state('all');
	let filterUnreadOnly = $state(false);
	let filterError = $state('');
	let filterBusy = $state(false);
	let selectionMode = $state(false);
	let selectedIds = $state<string[]>([]);
	let selectionAnchor = $state<string | null>(null);
	let bulkBusy = $state(false);
	let shortcutsOpen = $state(false);
	let keyboardId = $state<string | null>(null);

	onMount(() => {
		window.addEventListener('keydown', handleShortcut);
		const saved = readLocal('meu-hub:feed-view');
		if (saved === 'bento' || saved === 'compact' || saved === 'completo') {
			view = saved;
		} else if (saved === 'grid') {
			view = 'completo';
			writeLocal('meu-hub:feed-view', 'completo');
		}
		const searchMode = readLocal('meu-hub:saved-search-mode');
		if (searchMode === 'title' || searchMode === 'content') savedMode = searchMode;
		reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		if (!overview && !saved) {
			const batch = loadUndoBatch();
			if (batch) {
				undoIds = batch.ids;
				showToast(
					`${batch.ids.length} ${
						batch.ids.length === 1 ? 'post marcado' : 'posts marcados'
					} como lidos.`,
					'undo',
					0
				);
				scheduleUndoExpiry(batch.expiresAt);
			}
		}

		requestAnimationFrame(() => {
			viewReady = true;
		});
		const timer = setTimeout(() => {
			animationsEnabled = true;
			viewMotionReady = true;
		}, 400);

		return () => {
			window.removeEventListener('keydown', handleShortcut);
			clearTimeout(timer);
			clearTimeout(viewTimer);
			clearTimeout(undoTimer);
			clearTimeout(toastTimer);
		};
	});

	const motionDuration = $derived(reduceMotion || !animationsEnabled || !viewMotionReady ? 0 : 300);
	const fadeDuration = $derived(reduceMotion || !animationsEnabled || !viewMotionReady ? 0 : 160);

	function setView(next: FeedView): void {
		writeLocal('meu-hub:feed-view', next);
		if (next === view) return;

		viewMotionReady = false;
		view = next;
		clearTimeout(viewTimer);
		viewTimer = setTimeout(() => {
			viewMotionReady = true;
		}, 200);
	}

	const activeFilter = $derived(
		savedFilters.find((filter) => filter.id === activeFilterId) ?? null
	);
	const queryTerms = $derived(query.trim().split(/\s+/).filter(Boolean));
	const terms = $derived(activeFilter ? activeFilter.include : queryTerms);
	const exclude = $derived(activeFilter?.exclude ?? []);
	const mode = $derived(activeFilter?.matchMode ?? modeChoice);
	const unreadCounts = $derived(countUnread(entries));
	const scope = $derived(
		resolveScope(activeFilter, {
			categoryId: categoryFilter,
			sourceId: sourceFilter,
			unreadOnly
		})
	);
	const scopedSources = $derived(
		sources.filter(
			(source) =>
				(source.enabled || source.id === scope.sourceId) &&
				(scope.categoryId === 'all' || source.categoryId === scope.categoryId)
		)
	);
	const activeFilterCount = $derived(
		countActiveFeedFilters({
			query,
			activeFilterId,
			categoryId: scope.categoryId,
			sourceId: scope.sourceId,
			unreadOnly: scope.unreadOnly
		})
	);

	const base = $derived(
		entries.filter(
			(entry) =>
				(scope.categoryId === 'all' || entry.source.categoryId === scope.categoryId) &&
				(scope.sourceId === 'all' || entry.source.id === scope.sourceId)
		)
	);
	const filtered = $derived(
		base.filter((entry) => {
			if (scope.unreadOnly && entry.read) return false;
			return matchesFilter(`${entry.item.title}\n${entry.item.summary}`, terms, exclude, mode);
		})
	);
	const activeSource = $derived(
		scope.sourceId === 'all'
			? null
			: (sources.find((source) => source.id === scope.sourceId) ??
					entries.find((entry) => entry.source.id === scope.sourceId)?.source ??
					null)
	);
	const selectedSet = $derived(new Set(selectedIds));
	const selectedEntries = $derived(entries.filter((entry) => selectedSet.has(entry.item.id)));
	const filteredIds = $derived(filtered.map((entry) => entry.item.id));
	const savedTerms = $derived(savedQuery.trim().split(/\s+/).filter(Boolean));
	const savedFiltered = $derived(
		[...entries]
			.filter((entry) =>
				matchesFilter(
					`${entry.item.title}\n${entry.item.summary}\n${entry.source.name}`,
					savedTerms,
					[],
					'any'
				)
			)
			.sort((a, b) =>
				savedSort === 'saved'
					? (b.savedAt ?? b.item.publishedAt ?? '').localeCompare(
							a.savedAt ?? a.item.publishedAt ?? ''
						)
					: (b.item.publishedAt ?? '').localeCompare(a.item.publishedAt ?? '')
			)
	);
	const savedVisible = $derived(savedFiltered.slice(0, limit));
	const visible = $derived(saved ? savedVisible : filtered.slice(0, overview ? 5 : limit));
	const isEmpty = $derived(saved ? savedFiltered.length === 0 : filtered.length === 0);

	$effect(() => {
		if (initialFilterId !== lastInitialFilterId) {
			lastInitialFilterId = initialFilterId;
			activeFilterId = initialFilterId;
			filtersOpen = true;
			limit = 10;
		}
	});

	$effect(() => {
		if (initialSourceId !== lastInitialSourceId) {
			lastInitialSourceId = initialSourceId;
			sourceFilter = initialSourceId ?? 'all';
			filtersOpen = true;
			limit = 10;
		}
	});

	$effect(() => {
		if (initialUnreadOnly !== lastInitialUnreadOnly) {
			lastInitialUnreadOnly = initialUnreadOnly;
			unreadOnly = initialUnreadOnly;
			filtersOpen = true;
			limit = 10;
		}
	});

	function countFor(filter: SavedFilter): number {
		const categoryId = filter.categoryId ?? 'all';
		const sourceId = filter.sourceId ?? 'all';
		return entries.filter(
			(entry) =>
				(categoryId === 'all' || entry.source.categoryId === categoryId) &&
				(sourceId === 'all' || entry.source.id === sourceId) &&
				(!filter.unreadOnly || !entry.read) &&
				matchesFilter(
					`${entry.item.title}\n${entry.item.summary}`,
					filter.include,
					filter.exclude,
					filter.matchMode
				)
		).length;
	}

	function resetLimit(): void {
		limit = 10;
		if (selectedIds.length > 0) {
			selectedIds = [];
			selectionAnchor = null;
		}
	}

	function setSavedMode(mode: 'title' | 'content'): void {
		savedMode = mode;
		writeLocal('meu-hub:saved-search-mode', mode);
		resetLimit();
	}

	function enterSelection(): void {
		selectionMode = true;
		selectedIds = [];
		selectionAnchor = null;
		keyboardId = null;
	}

	function exitSelection(): void {
		selectionMode = false;
		selectedIds = [];
		selectionAnchor = null;
		keyboardId = null;
	}

	function toggleSelect(entry: FeedViewItem, event: MouseEvent): void {
		const result = updateSelection(selectedIds, entry.item.id, {
			visibleIds: filteredIds,
			anchor: selectionAnchor,
			mode: event.shiftKey ? 'range' : 'toggle'
		});
		selectedIds = result.selected;
		selectionAnchor = result.anchor;
	}

	function selectAllFiltered(): void {
		selectedIds = selectAll(filteredIds);
		selectionAnchor = null;
	}

	function clearSelection(): void {
		selectedIds = [];
		selectionAnchor = null;
	}

	async function bulkMarkRead(unread: boolean): Promise<void> {
		if (selectedIds.length === 0 || bulkBusy) return;
		bulkBusy = true;
		const ids = [...selectedIds];

		try {
			const ok = await sendState({
				action: unread ? 'mark-unread' : 'mark-all-read',
				ids
			});
			if (!ok) {
				showToast('Não foi possível atualizar os posts.', 'error', 5000);
				return;
			}

			if (!unread) {
				const batch = saveUndoBatch(ids);
				undoIds = batch.ids;
				showToast(
					`${ids.length} ${ids.length === 1 ? 'post marcado' : 'posts marcados'} como lidos.`,
					'undo',
					0
				);
				scheduleUndoExpiry(batch.expiresAt);
			} else {
				showToast(
					`${ids.length} ${ids.length === 1 ? 'post marcado' : 'posts marcados'} como não lidos.`,
					'success',
					4000
				);
			}

			exitSelection();
			await invalidateAll();
		} finally {
			bulkBusy = false;
		}
	}

	async function bulkSave(): Promise<void> {
		if (selectedIds.length === 0 || bulkBusy) return;
		const targets = selectedEntries.filter((entry) => !entry.saved);
		if (targets.length === 0) {
			showToast('Os posts selecionados já estão salvos.', 'success', 3500);
			return;
		}

		bulkBusy = true;
		try {
			const ok = await sendState({
				action: 'save-many',
				entries: targets.map((entry) => ({
					id: entry.item.id,
					snapshot: snapshotFromEntry(entry)
				}))
			});
			if (!ok) {
				showToast('Não foi possível salvar os posts.', 'error', 5000);
				return;
			}

			showToast(
				`${targets.length} ${targets.length === 1 ? 'post salvo' : 'posts salvos'}.`,
				'success',
				4000
			);
			exitSelection();
			await invalidateAll();
		} finally {
			bulkBusy = false;
		}
	}

	async function bulkUnsave(): Promise<void> {
		if (selectedIds.length === 0 || bulkBusy) return;
		const targets = selectedEntries.filter((entry) => entry.saved);
		if (targets.length === 0) {
			showToast('Nenhum dos selecionados está salvo.', 'success', 3500);
			return;
		}

		bulkBusy = true;
		try {
			const ok = await sendState({
				action: 'unsave-many',
				ids: targets.map((entry) => entry.item.id)
			});
			if (!ok) {
				showToast('Não foi possível remover os posts dos salvos.', 'error', 5000);
				return;
			}

			showToast(
				`${targets.length} ${targets.length === 1 ? 'post removido' : 'posts removidos'} dos salvos.`,
				'success',
				4000
			);
			exitSelection();
			await invalidateAll();
		} finally {
			bulkBusy = false;
		}
	}

	function isTypingTarget(target: EventTarget | null): boolean {
		const element = target as HTMLElement | null;
		if (!element) return false;
		const tag = element.tagName;
		if (tag === 'INPUT') {
			const type = (element as HTMLInputElement).type;
			return !['checkbox', 'radio', 'button', 'submit', 'reset'].includes(type);
		}
		return tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable;
	}

	function focusedEntry(): FeedViewItem | null {
		return visible.find((entry) => entry.item.id === keyboardId) ?? null;
	}

	function moveKeyboard(delta: number): void {
		if (visible.length === 0) return;
		const current = keyboardId ? visible.findIndex((entry) => entry.item.id === keyboardId) : -1;
		const next =
			current < 0
				? delta > 0
					? 0
					: visible.length - 1
				: Math.min(visible.length - 1, Math.max(0, current + delta));
		const entry = visible[next];
		keyboardId = entry.item.id;
		const element = document.getElementById(`feed-card-${entry.item.id}`);
		element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		element?.focus({ preventScroll: true });
	}

	function handleShortcut(event: KeyboardEvent): void {
		if (event.defaultPrevented) return;
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		if (isTypingTarget(event.target)) return;
		if (document.querySelector('[role="dialog"], dialog[open]')) return;

		if (event.key === '?') {
			event.preventDefault();
			shortcutsOpen = true;
			return;
		}

		if (event.key === 'Escape') {
			if (selectionMode) {
				event.preventDefault();
				exitSelection();
			} else {
				keyboardId = null;
			}
			return;
		}

		if (event.key === 'j') {
			event.preventDefault();
			moveKeyboard(1);
			return;
		}

		if (event.key === 'k') {
			event.preventDefault();
			moveKeyboard(-1);
			return;
		}

		const entry = focusedEntry();
		if (!entry) return;

		if (event.key === 'm') {
			event.preventDefault();
			toggleRead(entry);
		} else if (event.key === 's') {
			event.preventDefault();
			toggleSave(entry);
		} else if (event.key === 'o' || event.key === 'Enter') {
			if (event.key === 'Enter' && (event.target as HTMLElement | null)?.closest('button, a')) {
				return;
			}
			if (!canOpenEntry(entry)) return;
			event.preventDefault();
			window.open(entry.item.url, '_blank', 'noopener,noreferrer');
		}
	}

	function selectFilter(id: string): void {
		activeFilterId = activeFilterId === id ? null : id;
		resetLimit();
	}

	function categoryName(id: string | null | undefined): string {
		if (!id) return 'todas as categorias';
		return categories.find((category) => category.id === id)?.name ?? id;
	}

	function sourceName(id: string | null | undefined): string {
		if (!id) return 'todas as fontes';
		return sources.find((source) => source.id === id)?.name ?? id;
	}

	function chooseCategory(id: string): void {
		if (activeFilter?.categoryId && activeFilter.categoryId !== id) activeFilterId = null;
		categoryFilter = id;
		const validSource =
			id === 'all' ||
			sourceFilter === 'all' ||
			sources.some((source) => source.id === sourceFilter && source.categoryId === id);
		if (!validSource) sourceFilter = 'all';
		resetLimit();
	}

	function chooseSource(id: string): void {
		if (activeFilter?.sourceId && activeFilter.sourceId !== id) activeFilterId = null;
		sourceFilter = id;
		resetLimit();
	}

	function toggleUnread(): void {
		const next = !scope.unreadOnly;
		if (activeFilter?.unreadOnly !== undefined && activeFilter.unreadOnly !== next) {
			activeFilterId = null;
		}
		unreadOnly = next;
		resetLimit();
	}

	function requestMarkOlder(days: number): void {
		const ids = idsOlderThan(filtered, cutoffDaysAgo(days));
		if (ids.length === 0) {
			showToast('Nenhum post antigo não lido nesta visão.', 'success', 3500);
			return;
		}
		pendingMarkAllIds = ids;
		confirmMarkAll = true;
	}

	function openFilterForm(): void {
		filterLabel = activeFilter?.label ?? '';
		filterInclude = (activeFilter?.include ?? queryTerms).join(', ');
		filterExclude = (activeFilter?.exclude ?? []).join(', ');
		filterMode = activeFilter?.matchMode ?? modeChoice;
		filterCategory =
			activeFilter?.categoryId ?? (categoryFilter === 'all' ? 'all' : categoryFilter);
		filterSource = activeFilter?.sourceId ?? (sourceFilter === 'all' ? 'all' : sourceFilter);
		const sourceValid =
			filterSource === 'all' ||
			sources.some(
				(source) =>
					source.id === filterSource &&
					(filterCategory === 'all' || source.categoryId === filterCategory)
			);
		if (!sourceValid) filterSource = 'all';
		filterUnreadOnly = activeFilter?.unreadOnly ?? unreadOnly;
		filterError = '';
		showFilterForm = true;
	}

	async function saveFilter(): Promise<void> {
		const includeTerms = filterInclude
			.split(',')
			.map((term) => term.trim())
			.filter(Boolean);
		const excludeTerms = filterExclude
			.split(',')
			.map((term) => term.trim())
			.filter(Boolean);

		if (includeTerms.length === 0 && excludeTerms.length === 0) {
			filterError = 'Preencha Incluir ou Excluir antes de salvar.';
			return;
		}
		if (!filterLabel.trim()) {
			filterError = 'Informe um nome para o filtro.';
			return;
		}

		filterBusy = true;
		filterError = '';

		try {
			const response = await fetch('/api/hub', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					action: 'add-filter',
					filter: {
						label: filterLabel.trim(),
						include: includeTerms,
						exclude: excludeTerms,
						matchMode: filterMode,
						...(filterCategory !== 'all' ? { categoryId: filterCategory } : {}),
						...(filterSource !== 'all' ? { sourceId: filterSource } : {}),
						...(filterUnreadOnly ? { unreadOnly: true } : {})
					}
				})
			});
			const result = (await response.json()) as { ok?: boolean; error?: string };

			if (!response.ok || !result.ok) {
				filterError = result.error ?? 'Não foi possível salvar o filtro.';
				return;
			}

			showFilterForm = false;
			await invalidateAll();
		} catch {
			filterError = 'Falha de rede ao salvar o filtro.';
		} finally {
			filterBusy = false;
		}
	}

	async function sendState(body: unknown): Promise<boolean> {
		try {
			const response = await fetch('/api/state', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});
			return response.ok;
		} catch {
			return false;
		}
	}

	async function postState(body: unknown): Promise<boolean> {
		const ok = await sendState(body);
		if (ok) await invalidateAll();
		return ok;
	}

	function showToast(
		message: string,
		kind: 'undo' | 'success' | 'error',
		durationMs: number
	): void {
		toastMessage = message;
		toastKind = kind;
		clearTimeout(toastTimer);
		if (durationMs > 0) {
			toastTimer = setTimeout(() => {
				if (toastKind === kind) {
					toastMessage = '';
					toastKind = '';
				}
			}, durationMs);
		}
	}

	function scheduleUndoExpiry(expiresAt: number): void {
		clearTimeout(undoTimer);
		const remaining = Math.max(0, expiresAt - Date.now());
		undoTimer = setTimeout(() => {
			undoIds = [];
			clearUndoBatch();
			if (toastKind === 'undo') {
				toastMessage = '';
				toastKind = '';
			}
		}, remaining);
	}

	function toggleRead(entry: FeedViewItem): void {
		void postState({ action: entry.read ? 'unread' : 'read', id: entry.item.id });
	}

	function toggleSave(entry: FeedViewItem): void {
		void postState(
			entry.saved
				? { action: 'unsave', id: entry.item.id }
				: { action: 'save', id: entry.item.id, snapshot: snapshotFromEntry(entry) }
		);
	}

	function requestMarkAllRead(): void {
		const ids = filtered.filter((entry) => !entry.read).map((entry) => entry.item.id);
		if (ids.length === 0) return;
		pendingMarkAllIds = ids;
		confirmMarkAll = true;
	}

	async function confirmMarkAllRead(): Promise<void> {
		const ids = pendingMarkAllIds;
		confirmMarkAll = false;
		if (ids.length === 0) return;

		const ok = await sendState({ action: 'mark-all-read', ids });
		if (!ok) {
			showToast('Não foi possível marcar como lido.', 'error', 5000);
			return;
		}

		const batch = saveUndoBatch(ids);
		undoIds = batch.ids;
		showToast(
			`${ids.length} ${ids.length === 1 ? 'post marcado' : 'posts marcados'} como lidos.`,
			'undo',
			0
		);
		scheduleUndoExpiry(batch.expiresAt);
		await invalidateAll();
	}

	async function undoMarkAllRead(): Promise<void> {
		if (undoBusy || undoIds.length === 0) return;
		undoBusy = true;
		const ids = undoIds;

		try {
			const ok = await sendState({ action: 'mark-unread', ids });
			if (!ok) {
				showToast('Não foi possível desfazer. Tente novamente.', 'error', 6000);
				return;
			}

			clearUndoBatch();
			clearTimeout(undoTimer);
			undoIds = [];
			showToast('Leitura desfeita.', 'success', 4000);
			await invalidateAll();
		} finally {
			undoBusy = false;
		}
	}

	async function refresh(): Promise<void> {
		refreshing = true;
		refreshMessage = '';
		refreshFailed = false;
		refreshProgress = null;

		try {
			const job = await refreshWithProgress((progress) => {
				refreshProgress = progress;
			});

			const failed = job.results.filter((entry) => !entry.ok);
			refreshFailed = failed.length > 0;
			refreshMessage =
				failed.length > 0
					? `Atualizado com falha em: ${failed.map((entry) => entry.name).join(', ')}`
					: 'Feed atualizado.';
			await invalidateAll();
		} catch (error) {
			refreshMessage =
				error instanceof Error ? error.message : 'Falha de rede ao atualizar o feed.';
			refreshFailed = true;
		} finally {
			refreshing = false;
			refreshProgress = null;
		}
	}
</script>

<section class="section" aria-labelledby="t-feed" onpointerdown={() => (keyboardId = null)}>
	<div class="section-head">
		<div>
			<h2 id="t-feed">{title}</h2>
			{#if contextNote}
				<span class="muted small">{contextNote}</span>
			{/if}
		</div>
		<div class="chips">
			<div class="chips view-switch" role="group" aria-label="Visualização do feed">
				{#each viewOptions as option (option.id)}
					<button
						class="chip"
						class:active={view === option.id}
						type="button"
						aria-pressed={view === option.id}
						onclick={() => setView(option.id)}
					>
						{option.label}
					</button>
				{/each}
			</div>
			{#if overview || saved}
				<a class="chip link" href={resolve('/feed')}>Ver feed completo</a>
			{:else}
				<button class="chip link" type="button" onclick={requestMarkAllRead}>
					Marcar tudo como lido
				</button>
				{#if !selectionMode}
					<button class="chip link" type="button" onclick={enterSelection}>Selecionar</button>
				{/if}
				{#if undoIds.length > 0}
					<button class="chip" type="button" onclick={undoMarkAllRead} disabled={undoBusy}>
						{undoBusy ? 'Desfazendo...' : 'Desfazer'}
					</button>
				{/if}
				<button class="chip link" type="button" onclick={refresh} disabled={refreshing}>
					{refreshing
						? refreshProgress && refreshProgress.total > 0
							? `Atualizando ${refreshProgress.done}/${refreshProgress.total}...`
							: 'Atualizando...'
						: 'Atualizar agora'}
				</button>
			{/if}
		</div>
	</div>

	{#if selectionMode}
		<div class="bulk-bar" role="region" aria-label="Ações em massa">
			<strong aria-live="polite">
				{selectedIds.length}
				{selectedIds.length === 1 ? 'selecionado' : 'selecionados'}
			</strong>
			<div class="chips">
				<button
					class="chip"
					type="button"
					onclick={() => bulkMarkRead(false)}
					disabled={selectedIds.length === 0 || bulkBusy}
				>
					Marcar lido
				</button>
				<button
					class="chip"
					type="button"
					onclick={() => bulkMarkRead(true)}
					disabled={selectedIds.length === 0 || bulkBusy}
				>
					Marcar não lido
				</button>
				<button
					class="chip"
					type="button"
					onclick={bulkSave}
					disabled={selectedIds.length === 0 || bulkBusy}
				>
					Salvar
				</button>
				<button
					class="chip"
					type="button"
					onclick={bulkUnsave}
					disabled={selectedIds.length === 0 || bulkBusy}
				>
					Remover dos salvos
				</button>
				<button class="chip" type="button" onclick={selectAllFiltered} disabled={bulkBusy}>
					Selecionar todos os {filtered.length}
				</button>
				<button
					class="chip"
					type="button"
					onclick={clearSelection}
					disabled={selectedIds.length === 0 || bulkBusy}
				>
					Limpar
				</button>
				<button class="chip link" type="button" onclick={exitSelection} disabled={bulkBusy}>
					Sair da seleção
				</button>
			</div>
		</div>
	{/if}

	{#if refreshMessage}
		<div class:alert={refreshFailed} class:notice={!refreshFailed} role="status">
			{refreshMessage}
		</div>
	{/if}

	{#if saved}
		<div class="filter-panel saved-toolbar">
			<div class="filter-row">
				<div class="filter-input">
					<Icon name="filter" size={16} />
					<label class="sr-only" for="saved-search">Buscar nos salvos</label>
					<input
						id="saved-search"
						bind:value={savedQuery}
						placeholder="Buscar nos salvos"
						oninput={resetLimit}
					/>
				</div>
				<div class="chips" role="group" aria-label="Modo de busca">
					<button
						class="chip"
						class:active={savedMode === 'title'}
						type="button"
						aria-pressed={savedMode === 'title'}
						onclick={() => setSavedMode('title')}
					>
						Título
					</button>
					<button
						class="chip"
						class:active={savedMode === 'content'}
						type="button"
						aria-pressed={savedMode === 'content'}
						onclick={() => setSavedMode('content')}
					>
						Conteúdo
					</button>
				</div>
				{#if savedMode === 'title'}
					<div class="chips" role="group" aria-label="Ordenar a lista">
						<span class="muted small">Ordenar:</span>
						<button
							class="chip"
							class:active={savedSort === 'saved'}
							type="button"
							aria-pressed={savedSort === 'saved'}
							onclick={() => {
								savedSort = 'saved';
								resetLimit();
							}}
						>
							Salvamento
						</button>
						<button
							class="chip"
							class:active={savedSort === 'published'}
							type="button"
							aria-pressed={savedSort === 'published'}
							onclick={() => {
								savedSort = 'published';
								resetLimit();
							}}
						>
							Publicação
						</button>
					</div>
					<span class="muted small" style="margin-left: auto">
						Mostrando {Math.min(limit, savedFiltered.length)} de {savedFiltered.length} salvos
					</span>
				{/if}
			</div>
		</div>
	{/if}

	{#if !overview && !saved}
		<div class="filter-panel feed-filters">
			<div class="filter-row">
				<div class="filter-input">
					<Icon name="filter" size={16} />
					<label class="sr-only" for="kw">Filtrar por palavra-chave</label>
					<input
						id="kw"
						type="text"
						placeholder="Filtrar por palavra-chave (ex.: patch, hotfix)"
						bind:value={query}
						oninput={() => {
							activeFilterId = null;
							resetLimit();
						}}
					/>
				</div>
				<div class="chips">
					<button
						class="chip"
						type="button"
						aria-expanded={filtersOpen}
						aria-controls="feed-filters-extra"
						onclick={() => (filtersOpen = !filtersOpen)}
					>
						<Icon name="filter" size={14} />
						Filtros{#if activeFilterCount > 0}
							· {activeFilterCount}{/if}
						<Icon name={filtersOpen ? 'chevron-up' : 'chevron-down'} size={14} />
					</button>
					<span class="muted small filter-count">
						Mostrando {Math.min(limit, filtered.length)} de {filtered.length} posts
					</span>
				</div>
			</div>

			{#if filtersOpen}
				<div id="feed-filters-extra" class="filter-extra">
					<div class="chips">
						<button
							class="chip"
							class:active={mode === 'any'}
							type="button"
							aria-pressed={mode === 'any'}
							onclick={() => {
								modeChoice = 'any';
								activeFilterId = null;
							}}
						>
							Qualquer palavra
						</button>
						<button
							class="chip"
							class:active={mode === 'all'}
							type="button"
							aria-pressed={mode === 'all'}
							onclick={() => {
								modeChoice = 'all';
								activeFilterId = null;
							}}
						>
							Todas
						</button>
					</div>

					<div class="chips">
						{#if scope.sourceId !== 'all'}
							<button
								class="chip active"
								type="button"
								title="Remover filtro de fonte"
								onclick={() => {
									if (activeFilter?.sourceId) activeFilterId = null;
									sourceFilter = 'all';
									resetLimit();
								}}
							>
								Fonte: {activeSource?.name ?? scope.sourceId} ×
							</button>
						{/if}
						{#if savedFilters.length > 0}
							<span class="muted small">Filtros salvos</span>
							{#each savedFilters as filter (filter.id)}
								<button
									class="chip"
									class:active={activeFilterId === filter.id}
									type="button"
									aria-pressed={activeFilterId === filter.id}
									onclick={() => selectFilter(filter.id)}
								>
									{filter.label} · {countFor(filter)}
								</button>
							{/each}
						{/if}
						{#if activeFilter && (activeFilter.categoryId || activeFilter.sourceId || activeFilter.unreadOnly)}
							<span class="muted small">
								Escopo: {categoryName(activeFilter.categoryId)} · {sourceName(
									activeFilter.sourceId
								)}
								{activeFilter.unreadOnly ? ' · não lidos' : ''}
							</span>
						{/if}
						<button class="chip link" type="button" onclick={openFilterForm}>+ Salvar filtro</button
						>
					</div>

					{#if showFilterForm}
						<div class="filter-save">
							<div class="field filter-save-name">
								<label for="filter-label">Nome</label>
								<input
									id="filter-label"
									bind:value={filterLabel}
									placeholder="ex.: patch notes"
									maxlength="80"
								/>
							</div>
							<div class="field">
								<label for="filter-include">Incluir</label>
								<input id="filter-include" bind:value={filterInclude} placeholder="patch, hotfix" />
							</div>
							<div class="field">
								<label for="filter-exclude">Excluir</label>
								<input id="filter-exclude" bind:value={filterExclude} placeholder="promoção" />
							</div>
							<div class="field filter-save-mode">
								<label for="filter-mode">Modo</label>
								<select id="filter-mode" bind:value={filterMode}>
									<option value="any">Qualquer</option>
									<option value="all">Todas</option>
								</select>
							</div>
							<div class="field">
								<label for="filter-category">Categoria</label>
								<select
									id="filter-category"
									bind:value={filterCategory}
									onchange={() => {
										const valid =
											filterSource === 'all' ||
											sources.some(
												(source) =>
													source.id === filterSource &&
													(filterCategory === 'all' || source.categoryId === filterCategory)
											);
										if (!valid) filterSource = 'all';
									}}
								>
									<option value="all">Todas</option>
									{#each [...categories].sort((a, b) => a.order - b.order) as category (category.id)}
										<option value={category.id}>{category.name}</option>
									{/each}
								</select>
							</div>
							<div class="field">
								<label for="filter-source">Fonte</label>
								<select id="filter-source" bind:value={filterSource}>
									<option value="all">Todas</option>
									{#each sources.filter((source) => filterCategory === 'all' || source.categoryId === filterCategory) as source (source.id)}
										<option value={source.id}>{source.name}</option>
									{/each}
								</select>
							</div>
							<label class="check">
								<input type="checkbox" bind:checked={filterUnreadOnly} />
								Somente não lidos
							</label>
							<div class="chips filter-save-actions">
								<button
									class="btn btn-primary"
									type="button"
									onclick={saveFilter}
									disabled={filterBusy}
								>
									{filterBusy ? 'Salvando...' : 'Salvar'}
								</button>
								<button
									class="btn"
									type="button"
									onclick={() => (showFilterForm = false)}
									disabled={filterBusy}
								>
									Cancelar
								</button>
							</div>
							{#if filterError}
								<span class="error-text" role="alert">{filterError}</span>
							{/if}
						</div>
					{/if}

					<div class="chips" style="padding-top: 10px; border-top: 1px solid var(--line)">
						{#if showCategoryChips}
							<button
								class="chip"
								class:solid={scope.categoryId === 'all'}
								type="button"
								aria-pressed={scope.categoryId === 'all'}
								onclick={() => chooseCategory('all')}
							>
								Tudo
							</button>
							{#each [...categories].sort((a, b) => a.order - b.order) as category (category.id)}
								<button
									class="chip"
									class:active={scope.categoryId === category.id}
									type="button"
									aria-pressed={scope.categoryId === category.id}
									onclick={() => chooseCategory(category.id)}
								>
									{category.name}
									{#if unreadCounts.byCategory[category.id]}
										· {unreadCounts.byCategory[category.id]}
									{/if}
								</button>
							{/each}
						{/if}
						<button
							class="chip"
							class:active={scope.unreadOnly}
							type="button"
							aria-pressed={scope.unreadOnly}
							onclick={toggleUnread}
						>
							Não lidos
						</button>
					</div>

					{#if sources.length > 0}
						<div class="chips" role="group" aria-label="Filtrar por fonte">
							<span class="muted small">Fontes</span>
							<button
								class="chip"
								class:solid={scope.sourceId === 'all'}
								type="button"
								aria-pressed={scope.sourceId === 'all'}
								onclick={() => chooseSource('all')}
							>
								Todas
							</button>
							{#each scopedSources as source (source.id)}
								<button
									class="chip"
									class:active={scope.sourceId === source.id}
									type="button"
									aria-pressed={scope.sourceId === source.id}
									onclick={() => chooseSource(source.id)}
								>
									{source.name}
									{#if unreadCounts.bySource[source.id]}
										· {unreadCounts.bySource[source.id]}
									{/if}
								</button>
							{/each}
						</div>
					{/if}

					<div class="chips" role="group" aria-label="Marcar posts antigos como lidos">
						<span class="muted small">Marcar antigos:</span>
						<button class="chip" type="button" onclick={() => requestMarkOlder(1)}>1 dia</button>
						<button class="chip" type="button" onclick={() => requestMarkOlder(3)}>3 dias</button>
						<button class="chip" type="button" onclick={() => requestMarkOlder(7)}>7 dias</button>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	{#if saved && savedMode === 'content'}
		<SavedContentSearch query={savedQuery} savedCount={entries.length} />
	{:else}
		<div class="feed-container" class:view-ready={viewReady}>
			<div
				class="feed-layout"
				class:bento={view === 'bento'}
				class:completo-view={view === 'completo'}
				class:compact-view={view === 'compact'}
				class:motion-enabled={animationsEnabled && viewMotionReady}
				use:masonry={{ enabled: view === 'bento', gap: 12 }}
			>
				{#each visible as entry (entry.item.id)}
					<div
						class="feed-slot"
						class:selected={selectedSet.has(entry.item.id)}
						class:keyboard-focused={keyboardId === entry.item.id}
						id={`feed-card-${entry.item.id}`}
						tabindex="-1"
						in:fade={{ duration: fadeDuration }}
						out:fade={{ duration: fadeDuration }}
						animate:flip={{ duration: motionDuration }}
					>
						{#if selectionMode}
							<button
								type="button"
								class="select-surface"
								tabindex="-1"
								aria-label={`Selecionar ${entry.item.title}`}
								onclick={(event) => toggleSelect(entry, event)}
							></button>
							<button
								type="button"
								class="select-box"
								class:active={selectedSet.has(entry.item.id)}
								role="checkbox"
								aria-checked={selectedSet.has(entry.item.id)}
								title="Selecionar post"
								aria-label={`Selecionar ${entry.item.title}`}
								onclick={(event) => toggleSelect(entry, event)}
							>
								{#if selectedSet.has(entry.item.id)}
									<Icon name="check" size={14} />
								{/if}
							</button>
						{/if}
						<FeedCard
							{entry}
							terms={saved ? savedTerms : terms}
							variant={view}
							onread={() => toggleRead(entry)}
							onsave={() => toggleSave(entry)}
						/>
					</div>
				{/each}
			</div>
		</div>

		{#if isEmpty}
			<div class="placeholder-panel">
				<span class="placeholder-title">
					{entries.length === 0
						? emptyTitle || (saved ? 'Nenhum post salvo ainda' : 'Nenhum post no cache ainda')
						: saved
							? 'Nenhum salvo com essa busca'
							: 'Nenhum post com esse filtro'}
				</span>
				<span class="muted">
					{entries.length === 0
						? emptyHint ||
							(saved
								? "Use 'Salvar para depois' nos cards do feed."
								: 'Clique em "Atualizar agora" para buscar as fontes cadastradas.')
						: saved
							? 'Ajuste a busca ou o modo de ordenação.'
							: 'Ajuste a palavra-chave, o modo ou os filtros salvos.'}
				</span>
				{#if saved && entries.length === 0}
					<a class="chip link" href={resolve('/feed')}>Ir para o feed</a>
				{/if}
			</div>
		{/if}

		{#if saved ? limit < savedFiltered.length : !overview && limit < filtered.length}
			<button class="btn" type="button" style="align-self: center" onclick={() => (limit += 10)}>
				Carregar mais
			</button>
		{/if}
	{/if}
</section>

{#if confirmMarkAll}
	<ConfirmDialog
		title={`Marcar ${pendingMarkAllIds.length} ${
			pendingMarkAllIds.length === 1 ? 'post' : 'posts'
		} como lidos?`}
		message="Você pode desfazer por 30 segundos depois."
		confirmLabel="Marcar como lido"
		onconfirm={confirmMarkAllRead}
		oncancel={() => (confirmMarkAll = false)}
	/>
{/if}

{#if toastMessage}
	<div class="toast" role="status">
		<span>{toastMessage}</span>
		{#if undoIds.length > 0}
			<button class="chip" type="button" onclick={undoMarkAllRead} disabled={undoBusy}>
				{undoBusy ? 'Desfazendo...' : 'Desfazer'}
			</button>
		{/if}
	</div>
{/if}

{#if shortcutsOpen}
	<ShortcutHelp onclose={() => (shortcutsOpen = false)} />
{/if}
