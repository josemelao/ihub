<script lang="ts">
	import { resolve } from '$app/paths';
	import { itemHref, itemKind } from '#lib/display';
	import { moveQuickAccess, quickAccessItems, quickAccessOrderFor } from '#lib/quick-access';
	import type { HubData } from '#lib/types';
	import ItemIcon from './ItemIcon.svelte';

	let {
		hub,
		title = 'Acesso rápido',
		stacked = false,
		grid = false,
		limit,
		onreorder,
		onpin
	}: {
		hub: HubData;
		title?: string;
		stacked?: boolean;
		grid?: boolean;
		limit?: number;
		onreorder?: (ids: string[]) => void;
		onpin?: (id: string, pinned: boolean) => void;
	} = $props();

	const colors = $derived(Object.fromEntries(hub.categories.map((cat) => [cat.id, cat.color])));
	const quick = $derived(quickAccessItems(hub, limit));

	let editing = $state(false);
	let draggingId = $state<string | null>(null);

	function orderFor(ids: string[]): string[] {
		return quickAccessOrderFor(hub, ids);
	}

	function move(id: string, direction: -1 | 1): void {
		const ids = quick.map((item) => item.id);
		const next = moveQuickAccess(ids, id, direction);
		if (next === ids) return;
		onreorder?.(orderFor(next));
	}

	function dropOn(targetId: string): void {
		if (!draggingId || draggingId === targetId) return;
		const ids = quick.map((item) => item.id);
		const from = ids.indexOf(draggingId);
		const to = ids.indexOf(targetId);
		if (from < 0 || to < 0) return;
		const next = [...ids];
		next.splice(from, 1);
		next.splice(to, 0, draggingId);
		draggingId = null;
		onreorder?.(orderFor(next));
	}
</script>

<section class="section" aria-labelledby="t-rapido">
	<div class="section-head">
		<h2 id="t-rapido">{title}</h2>
		<div class="quick-actions">
			{#if onreorder && quick.length > 1}
				<button class="chip link" type="button" onclick={() => (editing = !editing)}>
					{editing ? 'Concluir' : 'Reordenar'}
				</button>
			{/if}
			<a class="muted small" href={resolve('/gerenciar')}>Editar atalhos</a>
		</div>
	</div>
	<div class="quick-grid" class:stacked class:grid>
		{#each quick as item (item.id)}
			{@const color = colors[item.categoryId] ?? '#8AA4FF'}
			<div class="quick-slot" class:editing>
				<a
					class="quick-tile"
					href={itemHref(item)}
					target={item.type === 'link' ? '_blank' : undefined}
					rel="noopener noreferrer"
					title={item.description ?? undefined}
					draggable={Boolean(onreorder)}
					ondragstart={() => (draggingId = item.id)}
					ondragover={(event) => event.preventDefault()}
					ondrop={(event) => {
						event.preventDefault();
						dropOn(item.id);
					}}
				>
					<ItemIcon {item} {color} size={34} />
					<span class="quick-meta">
						<span class="quick-name">{item.name}</span>
						<span class="quick-kind">{itemKind(item)}</span>
					</span>
				</a>
				{#if editing}
					<div class="quick-edit">
						<button
							class="mini-btn"
							type="button"
							aria-label={`Mover ${item.name} para cima`}
							disabled={quick[0]?.id === item.id}
							onclick={() => move(item.id, -1)}
						>
							↑
						</button>
						<button
							class="mini-btn"
							type="button"
							aria-label={`Mover ${item.name} para baixo`}
							disabled={quick[quick.length - 1]?.id === item.id}
							onclick={() => move(item.id, 1)}
						>
							↓
						</button>
						{#if onpin}
							<button
								class="mini-btn"
								type="button"
								aria-label={`Desafixar ${item.name}`}
								onclick={() => onpin(item.id, false)}
							>
								✕
							</button>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
		{#if quick.length === 0}
			<p class="muted">
				Nenhum atalho fixado ainda. Fixe um item na Biblioteca ou no editor de itens.
			</p>
		{/if}
	</div>
</section>
