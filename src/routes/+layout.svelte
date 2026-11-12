<script lang="ts">
	import { onMount } from 'svelte';
	import { afterNavigate, invalidateAll } from '$app/navigation';
	import '../app.css';
	import Sidebar from '#lib/components/Sidebar.svelte';
	import CommandPalette from '#lib/components/CommandPalette.svelte';
	import QuickAddDialog from '#lib/components/QuickAddDialog.svelte';
	import { contrastText } from '#lib/display';
	import { countUnread } from '#lib/feed/triage';
	import { buildFeedView } from '#lib/feed/view';
	import { faviconBadgeDataUrl, formatUnreadTitle, shouldNotify } from '#lib/notifications';
	import { ui } from '#lib/ui.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	let setupError = $state('');
	let setupBusy = $state(false);

	async function initialize(mode: 'example' | 'empty'): Promise<void> {
		setupBusy = true;
		setupError = '';
		try {
			const response = await fetch('/api/setup', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ mode })
			});
			if (!response.ok) {
				const body = (await response.json()) as { error?: string };
				setupError = body.error ?? 'Não foi possível criar o hub.json.';
				return;
			}
			await invalidateAll();
		} catch {
			setupError = 'Falha de rede ao criar o hub.json.';
		} finally {
			setupBusy = false;
		}
	}

	const feedEntries = $derived(buildFeedView(data.hub, data.feed, data.state));
	const unread = $derived(feedEntries.filter((entry) => !entry.read).length);
	const unreadByCategory = $derived(countUnread(feedEntries).byCategory);

	onMount(() => {
		if (import.meta.env.PROD && 'serviceWorker' in navigator) {
			navigator.serviceWorker.register('/service-worker.js').catch(() => undefined);
		}
	});

	afterNavigate(() => ui.closeNav());

	// Densidade, tamanho de fonte e contraste são atributos globais do <html>.
	$effect(() => {
		const root = document.documentElement;
		root.dataset.density = data.hub.settings.density ?? 'comfortable';
		root.dataset.contrast = data.hub.settings.highContrast ? 'high' : 'normal';
		root.dataset.font = String(data.hub.settings.fontSize ?? 14);
	});

	let previousUnread: number | null = null;

	// Título, badge no favicon e notificação opcional de posts novos.
	$effect(() => {
		const count = unread;
		document.title = formatUnreadTitle(count);

		const badge = faviconBadgeDataUrl(count);
		if (badge) {
			let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
			if (!link) {
				link = document.createElement('link');
				link.rel = 'icon';
				document.head.append(link);
			}
			link.href = badge;
		} else {
			document
				.querySelector<HTMLLinkElement>('link[rel="icon"]')
				?.setAttribute('href', '/favicon.svg');
		}

		const permission = typeof Notification === 'undefined' ? 'denied' : Notification.permission;
		if (
			typeof Notification !== 'undefined' &&
			shouldNotify({
				previous: previousUnread,
				current: count,
				permission,
				hidden: document.visibilityState === 'hidden',
				enabled: Boolean(data.hub.settings.notifyUnread)
			})
		) {
			try {
				new Notification(`${count - (previousUnread ?? 0)} posts novos no Meu Hub`);
			} catch {
				// notificação indisponível: ignora
			}
		}

		previousUnread = count;
	});

	function onKeydown(event: KeyboardEvent): void {
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			ui.openPalette();
		} else if (event.key === 'Escape' && ui.navOpen) {
			ui.closeNav();
		} else if (event.key === 'Escape' && ui.paletteOpen) {
			ui.closePalette();
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<svelte:head>
	<title>Meu Hub</title>
	<meta name="theme-color" content="#0F1115" />
</svelte:head>

<a class="skip-link" href="#conteudo">Pular para o conteúdo</a>

<div
	class="app-shell"
	style="--accent: {data.hub.settings.accent}; --on-accent: {contrastText(
		data.hub.settings.accent
	)}"
>
	{#if ui.navOpen}
		<button
			class="nav-backdrop"
			type="button"
			aria-label="Fechar menu"
			onclick={() => ui.closeNav()}
		></button>
	{/if}
	<Sidebar
		hub={data.hub}
		open={ui.navOpen}
		{unread}
		{unreadByCategory}
		savedCount={data.state.saved.length}
		highlightsCount={data.highlights.highlights.length}
	/>

	<main class="main" id="conteudo">
		{#if data.hubMissing}
			<div class="alert first-run" role="region" aria-label="Primeiro uso">
				<strong>Primeiro uso</strong>
				<div>
					Não encontrei <code>hub.json</code> em <code>{data.dataDir}</code>. Escolha como começar;
					depois você pode editar tudo em <strong>Gerenciar</strong> ou importar seus favoritos.
				</div>
				<div class="chips">
					<button
						class="btn btn-primary"
						type="button"
						disabled={setupBusy}
						onclick={() => initialize('example')}
					>
						Começar com exemplo
					</button>
					<button
						class="btn"
						type="button"
						disabled={setupBusy}
						onclick={() => initialize('empty')}
					>
						Começar vazio
					</button>
				</div>
				{#if setupError}
					<span class="error-text">{setupError}</span>
				{/if}
			</div>
		{/if}

		{#if data.dataError}
			<div class="alert" role="alert">
				<strong>{data.dataError.message}</strong>
				{#if data.dataError.usingBackup}
					<div>Exibindo o último backup válido (<code>hub.json.bak</code>).</div>
				{:else}
					<div>Nenhum backup válido encontrado; exibindo um hub vazio.</div>
				{/if}
				<ul>
					{#each data.dataError.issues.slice(0, 5) as issue, index (index)}
						<li>
							<code>{issue.path.length ? issue.path.join(' › ') : 'arquivo'}</code>: {issue.message}
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		{#if data.stateError || data.cacheError || data.notesError}
			<div class="alert" role="alert">
				<strong>Dados auxiliares inválidos</strong>
				{#if data.stateError}
					<div>
						estado.json: {data.stateError.message}
						{data.stateError.usingBackup ? 'Usando o backup.' : 'Usando estado vazio.'}
					</div>
				{/if}
				{#if data.cacheError}
					<div>
						feed-cache.json: {data.cacheError.message}
						{data.cacheError.usingBackup ? 'Usando o backup.' : 'Usando cache vazio.'}
					</div>
				{/if}
				{#if data.notesError}
					<div>
						notes.json: {data.notesError.message}
						{data.notesError.usingBackup ? 'Usando o backup.' : 'Usando notas vazias.'}
					</div>
				{/if}
			</div>
		{/if}

		{#if data.stateRecovery}
			<div class="alert" role="status">
				<strong>estado.json recuperado</strong>
				<div>
					{#if data.stateRecovery.removedSnapshots > 0}
						{data.stateRecovery.removedSnapshots} snapshot(s) inválido(s),{/if}
					{#if data.stateRecovery.removedRead > 0}
						{data.stateRecovery.removedRead} leitura(s) inválida(s),{/if}
					{#if data.stateRecovery.removedSaved > 0}
						{data.stateRecovery.removedSaved} id(s) salvo(s) inválido(s),{/if}
					foram descartados; o restante foi mantido.
				</div>
			</div>
		{/if}

		{@render children()}
	</main>
</div>

{#if ui.paletteOpen}
	<CommandPalette
		hub={data.hub}
		feed={data.feed}
		hubState={data.state}
		notes={data.notes}
		onclose={() => ui.closePalette()}
	/>
{/if}

{#if ui.quickAddOpen}
	<QuickAddDialog onclose={() => ui.closeQuickAdd()} />
{/if}
