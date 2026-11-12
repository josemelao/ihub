<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { relativeTime } from '#lib/display';
	import { HOME_ACTIONS } from '#lib/home-actions';
	import { refreshWithProgress } from '#lib/refresh-client';
	import type { FeedCache, HubData, HubState } from '#lib/types';
	import Icon from './Icon.svelte';
	import QuickAccess from './QuickAccess.svelte';

	let { hub, feed, hubState }: { hub: HubData; feed: FeedCache; hubState: HubState } = $props();

	const unread = $derived(feed.items.filter((item) => !hubState.read[item.id]).length);
	const saved = $derived(hubState.saved.length);
	const today = $derived.by(() => {
		const todayKey = new Date().toDateString();
		return feed.items.filter(
			(item) => item.publishedAt && new Date(item.publishedAt).toDateString() === todayKey
		).length;
	});
	const errors = $derived(
		hub.feedSources.filter((source) => source.enabled && Boolean(feed.sources[source.id]?.error))
	);
	const errorNames = $derived(errors.map((source) => source.name).join(', '));
	const updated = $derived(
		feed.items.length > 0 ? relativeTime(feed.updatedAt) : 'nunca atualizado'
	);

	let busy = $state(false);
	let message = $state('');
	let progress = $state<{ done: number; total: number } | null>(null);
	let backupBusy = $state(false);
	let actionMessage = $state('');

	async function updateHub(payload: unknown): Promise<void> {
		const response = await fetch('/api/hub', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload)
		});
		if (!response.ok) {
			message = 'Falha ao salvar o Acesso rápido.';
			return;
		}
		await invalidateAll();
	}

	function reorderQuickAccess(ids: string[]): void {
		void updateHub({ action: 'update-settings', settings: { quickAccessOrder: ids } });
	}

	function togglePin(id: string, pinned: boolean): void {
		void updateHub({ action: 'update-item', id, patch: { pinned } });
	}

	function setQuickLimit(limit: number): void {
		void updateHub({ action: 'update-settings', settings: { quickAccessLimit: limit } });
	}

	async function refreshNow(): Promise<void> {
		busy = true;
		message = '';
		progress = null;
		try {
			const job = await refreshWithProgress((value) => {
				progress = value;
			});
			const failed = job.results.filter((entry) => !entry.ok);
			message =
				failed.length > 0
					? `Falha em: ${failed.map((entry) => entry.name).join(', ')}`
					: 'Feed atualizado.';
			await invalidateAll();
		} catch (error) {
			message = error instanceof Error ? error.message : 'Falha de rede ao atualizar.';
		} finally {
			busy = false;
			progress = null;
		}
	}

	async function backupNow(): Promise<void> {
		backupBusy = true;
		actionMessage = '';
		try {
			const response = await fetch('/api/backup', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: '{}'
			});
			const body = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
			actionMessage =
				response.ok && body.ok ? 'Backup criado.' : (body.error ?? 'Falha ao criar backup.');
		} catch {
			actionMessage = 'Falha de rede ao criar backup.';
		} finally {
			backupBusy = false;
		}
	}
</script>

<section class="dashboard-grid" aria-label="Painel geral">
	<section class="panel dashboard-card" aria-labelledby="d-rapido">
		<QuickAccess
			{hub}
			title="Acesso rápido"
			grid
			limit={hub.settings.quickAccessLimit ?? 6}
			onreorder={reorderQuickAccess}
			onpin={togglePin}
			onlimit={setQuickLimit}
		/>
		<span class="sr-only" id="d-rapido">Acesso rápido</span>
	</section>

	<section class="panel dashboard-card" aria-labelledby="d-resumo">
		<h2 id="d-resumo" class="dashboard-title">Resumo do dia</h2>
		<div class="metric-grid">
			<a class="metric" href={resolve('/feed') + '?nao-lidos=1'}>
				<span class="metric-value">{unread}</span>
				<span class="metric-label">não lidos</span>
			</a>
			<a class="metric" href={resolve('/favoritos')}>
				<span class="metric-value">{saved}</span>
				<span class="metric-label">salvos</span>
			</a>
			<a class="metric" href={resolve('/feed')}>
				<span class="metric-value">{today}</span>
				<span class="metric-label">posts hoje</span>
			</a>
			<a
				class="metric"
				href={resolve('/gerenciar') + '?tab=fontes&status=erro'}
				title={errorNames || 'Nenhuma fonte ativa com erro'}
			>
				<span class="metric-value">{errors.length}</span>
				<span class="metric-label">fontes com erro</span>
			</a>
		</div>
		<span class="muted small">Atualizado {updated}</span>
	</section>

	<section class="panel dashboard-card" aria-labelledby="d-acoes">
		<h2 id="d-acoes" class="dashboard-title">Ações rápidas</h2>
		<div class="action-grid">
			{#each HOME_ACTIONS as action (action.id)}
				{#if action.href}
					<a class="action-row" href={action.href} download={action.download ? '' : undefined}>
						<Icon name={action.icon} size={14} />
						{action.label}
					</a>
				{:else if action.id === 'backup'}
					<button class="action-row" type="button" onclick={backupNow} disabled={backupBusy}>
						<Icon name={action.icon} size={14} />
						{backupBusy ? 'Criando backup…' : action.label}
					</button>
				{:else}
					<button class="action-row" type="button" onclick={refreshNow} disabled={busy}>
						<Icon name={action.icon} size={14} />
						{busy
							? progress && progress.total > 0
								? `Atualizando ${progress.done}/${progress.total}...`
								: 'Atualizando...'
							: action.label}
					</button>
				{/if}
			{/each}
		</div>
		{#if actionMessage}
			<span class="muted small" role="status">{actionMessage}</span>
		{/if}
		{#if message}
			<span class="muted small" role="status">{message}</span>
		{/if}
	</section>
</section>
