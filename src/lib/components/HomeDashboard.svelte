<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { relativeTime } from '#lib/display';
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
		Object.values(feed.sources).filter((source) => source.error !== null).length
	);
	const updated = $derived(
		feed.items.length > 0 ? relativeTime(feed.updatedAt) : 'nunca atualizado'
	);

	let busy = $state(false);
	let message = $state('');

	async function refreshNow(): Promise<void> {
		busy = true;
		message = '';
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
				message = result.error ?? 'Falha ao atualizar o feed.';
			} else {
				const failed = (result.results ?? []).filter((entry) => !entry.ok);
				message =
					failed.length > 0
						? `Falha em: ${failed.map((entry) => entry.name).join(', ')}`
						: 'Feed atualizado.';
			}
			await invalidateAll();
		} catch {
			message = 'Falha de rede ao atualizar.';
		} finally {
			busy = false;
		}
	}
</script>

<section class="dashboard-grid" aria-label="Painel geral">
	<section class="panel dashboard-card" aria-labelledby="d-rapido">
		<QuickAccess {hub} title="Acesso rápido" grid limit={6} />
		<span class="sr-only" id="d-rapido">Acesso rápido</span>
	</section>

	<section class="panel dashboard-card" aria-labelledby="d-resumo">
		<h2 id="d-resumo" class="dashboard-title">Resumo do dia</h2>
		<div class="metric-grid">
			<div class="metric">
				<span class="metric-value">{unread}</span>
				<span class="metric-label">não lidos</span>
			</div>
			<div class="metric">
				<span class="metric-value">{saved}</span>
				<span class="metric-label">salvos</span>
			</div>
			<div class="metric">
				<span class="metric-value">{today}</span>
				<span class="metric-label">posts hoje</span>
			</div>
			<div class="metric">
				<span class="metric-value">{errors}</span>
				<span class="metric-label">fontes com erro</span>
			</div>
		</div>
		<span class="muted small">Atualizado {updated}</span>
	</section>

	<section class="panel dashboard-card" aria-labelledby="d-acoes">
		<h2 id="d-acoes" class="dashboard-title">Ações rápidas</h2>
		<div class="action-list">
			<button class="action-row" type="button" onclick={refreshNow} disabled={busy}>
				<Icon name="rss" size={16} />
				{busy ? 'Atualizando...' : 'Atualizar agora'}
			</button>
			<a class="action-row" href={resolve('/feed')}>
				<Icon name="rss" size={16} />
				Ver feed completo
			</a>
			<a class="action-row" href={resolve('/favoritos')}>
				<Icon name="star" size={16} />
				Favoritos
			</a>
			<a class="action-row" href={resolve('/gerenciar')}>
				<Icon name="settings" size={16} />
				Gerenciar fontes e links
			</a>
			<a class="action-row" href={resolve('/api/export')} download>
				<Icon name="download" size={16} />
				Exportar dados
			</a>
		</div>
		{#if message}
			<span class="muted small">{message}</span>
		{/if}
	</section>
</section>
