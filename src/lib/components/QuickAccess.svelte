<script lang="ts">
	import { resolve } from '$app/paths';
	import { itemHref, itemKind, tint } from '#lib/display';
	import {
		DEFAULT_QUICK_ACCESS_LIMIT,
		moveQuickAccess,
		quickAccessEntries,
		quickAccessOrderFor,
		type QuickAccessEntry
	} from '#lib/quick-access';
	import type { HubData } from '#lib/types';
	import Icon from './Icon.svelte';
	import ItemIcon from './ItemIcon.svelte';

	let {
		hub,
		title = 'Acesso rápido',
		stacked = false,
		grid = false,
		limit = DEFAULT_QUICK_ACCESS_LIMIT,
		onreorder,
		onunpin
	}: {
		hub: HubData;
		title?: string;
		stacked?: boolean;
		grid?: boolean;
		limit?: number;
		onreorder?: (keys: string[]) => void;
		onunpin?: (kind: 'item' | 'group', id: string) => void;
	} = $props();

	const colors = $derived(Object.fromEntries(hub.categories.map((cat) => [cat.id, cat.color])));
	const all = $derived(quickAccessEntries(hub, Number.POSITIVE_INFINITY));
	const visible = $derived(all.slice(0, limit));
	const pinnedCount = $derived(
		hub.items.filter((item) => item.pinned).length +
			hub.groups.filter((group) => group.pinned).length
	);
	const hiddenCount = $derived(Math.max(0, pinnedCount - visible.length));

	let editing = $state(false);
	let draggingId = $state<string | null>(null);

	const shown = $derived(editing ? all : visible);

	function orderFor(keys: string[]): string[] {
		return quickAccessOrderFor(hub, keys);
	}

	function move(key: string, direction: -1 | 1): void {
		const keys = all.map((entry) => entry.key);
		const next = moveQuickAccess(keys, key, direction);
		if (next === keys) return;
		onreorder?.(orderFor(next));
	}

	function dropOn(targetKey: string): void {
		if (!draggingId || draggingId === targetKey) return;
		const keys = all.map((entry) => entry.key);
		const from = keys.indexOf(draggingId);
		const to = keys.indexOf(targetKey);
		if (from < 0 || to < 0) return;
		const next = [...keys];
		next.splice(from, 1);
		next.splice(to, 0, draggingId);
		draggingId = null;
		onreorder?.(orderFor(next));
	}

	function colorOf(entry: QuickAccessEntry): string {
		return entry.kind === 'item'
			? (colors[entry.item.categoryId] ?? '#8AA4FF')
			: (colors[entry.group.categoryId] ?? '#8AA4FF');
	}

	function labelOf(entry: QuickAccessEntry): string {
		if (entry.kind === 'item') return itemKind(entry.item);
		return entry.count === 1 ? 'Grupo · 1 item' : `Grupo · ${entry.count} itens`;
	}

	function hrefOf(entry: QuickAccessEntry): string {
		if (entry.kind === 'item') return itemHref(entry.item);
		return `${resolve('/biblioteca')}?grupo=${encodeURIComponent(entry.id)}`;
	}
</script>

<section class="section" aria-labelledby="t-rapido">
	<div class="section-head">
		<h2 id="t-rapido">{title}</h2>
		<div class="quick-actions">
			{#if onreorder && all.length > 1}
				<button
					class="chip link"
					type="button"
					aria-pressed={editing}
					title={hiddenCount > 0
						? `+${hiddenCount} fixado(s) fora do acesso rápido; reordene ou desafixe aqui`
						: undefined}
					onclick={() => (editing = !editing)}
				>
					{editing ? 'Concluir' : 'Reordenar'}{#if hiddenCount > 0 && !editing}
						· +{hiddenCount}{/if}
				</button>
			{/if}
			<a class="muted small" href={resolve('/gerenciar')}>Editar atalhos</a>
		</div>
	</div>
	<div class="quick-grid" class:stacked class:grid class:editing>
		{#each shown as entry, index (entry.key)}
			{#if editing && index === limit && hiddenCount > 0}
				<p class="quick-overflow-label">
					Fora do acesso rápido · {hiddenCount}
				</p>
			{/if}
			<div class="quick-slot" class:editing class:overflow={editing && index >= limit}>
				<a
					class="quick-tile"
					href={hrefOf(entry)}
					target={entry.kind === 'item' && entry.item.type === 'link' ? '_blank' : undefined}
					rel="noopener noreferrer"
					title={entry.kind === 'item'
						? (entry.item.description ?? undefined)
						: `Abrir ${entry.group.name} na biblioteca`}
					draggable={editing && Boolean(onreorder)}
					ondragstart={() => (draggingId = entry.key)}
					ondragend={() => (draggingId = null)}
					ondragover={(event) => {
						if (editing) event.preventDefault();
					}}
					ondrop={(event) => {
						if (!editing) return;
						event.preventDefault();
						dropOn(entry.key);
					}}
				>
					{#if entry.kind === 'item'}
						<ItemIcon item={entry.item} color={colorOf(entry)} size={30} />
					{:else}
						<span
							class="quick-avatar"
							style={`background: ${tint(colorOf(entry), 0.16)}; color: ${colorOf(entry)}`}
						>
							<Icon name="layers" size={17} />
						</span>
					{/if}
					<span class="quick-meta">
						<span class="quick-name">
							{entry.kind === 'item' ? entry.item.name : entry.group.name}
						</span>
						<span class="quick-kind">{labelOf(entry)}</span>
					</span>
					{#if editing}
						<span class="quick-index" aria-hidden="true">{index + 1}</span>
					{/if}
				</a>
				{#if editing}
					<div class="quick-edit">
						<button
							class="mini-btn"
							type="button"
							aria-label={`Mover ${entry.kind === 'item' ? entry.item.name : entry.group.name} para cima`}
							title="Mover para cima"
							disabled={index === 0}
							onclick={() => move(entry.key, -1)}
						>
							↑
						</button>
						<button
							class="mini-btn"
							type="button"
							aria-label={`Mover ${entry.kind === 'item' ? entry.item.name : entry.group.name} para baixo`}
							title="Mover para baixo"
							disabled={index === all.length - 1}
							onclick={() => move(entry.key, 1)}
						>
							↓
						</button>
						{#if onunpin}
							<button
								class="mini-btn"
								type="button"
								aria-label={`Desafixar ${entry.kind === 'item' ? entry.item.name : entry.group.name}`}
								title="Desafixar do acesso rápido"
								onclick={() => onunpin(entry.kind, entry.id)}
							>
								✕
							</button>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
		{#if all.length === 0}
			<p class="muted">
				Nenhum atalho fixado ainda. Fixe um item ou grupo na Biblioteca ou no editor.
			</p>
		{/if}
	</div>
</section>
