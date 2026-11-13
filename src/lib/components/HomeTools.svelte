<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { HOME_ACTIONS } from '#lib/home-actions';
	import { refreshWithProgress } from '#lib/refresh-client';
	import Icon from './Icon.svelte';

	let busy = $state(false);
	let message = $state('');
	let progress = $state<{ done: number; total: number } | null>(null);
	let backupBusy = $state(false);
	let actionMessage = $state('');

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
