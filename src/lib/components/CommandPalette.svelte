<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import { initials, tint } from '#lib/display';
	import { buildPaletteItems, searchPalette, type PaletteItem } from '#lib/palette';
	import { refreshWithProgress } from '#lib/refresh-client';
	import type { FeedCache, HubData, HubState, NotesData } from '#lib/types';
	import Icon from './Icon.svelte';

	let {
		hub,
		feed,
		hubState,
		notes,
		onclose
	}: {
		hub: HubData;
		feed?: FeedCache;
		hubState?: HubState;
		notes?: NotesData;
		onclose: () => void;
	} = $props();

	let query = $state('');
	let active = $state(0);
	let inputEl = $state<HTMLInputElement | null>(null);
	let paletteEl = $state<HTMLElement | null>(null);

	const index = $derived(buildPaletteItems({ hub, feed, state: hubState, notes }));
	const results = $derived(searchPalette(index, query, 10));

	onMount(() => {
		const previousFocus = document.activeElement as HTMLElement | null;
		inputEl?.focus();
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = '';
			previousFocus?.focus();
		};
	});

	$effect(() => {
		if (active > results.length - 1) {
			active = Math.max(0, results.length - 1);
		}
	});

	async function choose(entry: PaletteItem): Promise<void> {
		onclose();

		if (entry.commandId === 'refresh') {
			try {
				await refreshWithProgress();
				await invalidateAll();
			} catch {
				// sem UI de erro aqui; o feed mostra o estado na próxima ação
			}
			return;
		}

		if (!entry.href) return;

		if (entry.href.startsWith('/api/')) {
			window.location.href = entry.href;
			return;
		}

		if (entry.type === 'link' || entry.type === 'post') {
			window.open(entry.href, '_blank', 'noopener,noreferrer');
			return;
		}

		// eslint-disable-next-line svelte/no-navigation-without-resolve
		await goto(entry.href);
	}

	function onKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			onclose();
			return;
		}

		if (event.key === 'Tab') {
			const focusables = paletteEl?.querySelectorAll<HTMLElement>(
				'input, button, a[href], [tabindex]:not([tabindex="-1"])'
			);
			if (!focusables || focusables.length === 0) return;
			const first = focusables[0];
			const last = focusables[focusables.length - 1];
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
			return;
		}

		if (results.length === 0) return;

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			active = Math.min(active + 1, results.length - 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			active = Math.max(active - 1, 0);
		} else if (event.key === 'Enter' && results[active]) {
			event.preventDefault();
			void choose(results[active]);
		}
	}

	function handleBackdrop(event: MouseEvent): void {
		if (event.target === event.currentTarget) onclose();
	}

	function typeLabel(entry: PaletteItem): string {
		switch (entry.type) {
			case 'category':
				return 'Categoria';
			case 'app':
				return 'App do PC';
			case 'post':
				return 'Post';
			case 'note':
				return 'Nota';
			case 'source':
				return 'Fonte';
			case 'command':
				return 'Comando';
			default:
				return 'Link';
		}
	}
</script>

<div class="palette-backdrop" role="presentation" onclick={handleBackdrop}>
	<div
		bind:this={paletteEl}
		class="palette"
		role="dialog"
		aria-modal="true"
		aria-label="Busca e comandos"
		tabindex="-1"
		onkeydown={onKeydown}
	>
		<div class="palette-search">
			<Icon name="search" />
			<input
				bind:this={inputEl}
				bind:value={query}
				oninput={() => (active = 0)}
				placeholder="Buscar ou > comando · tag: source: is:unread is:saved"
				role="combobox"
				aria-expanded="true"
				aria-controls="palette-list"
				aria-autocomplete="list"
				aria-activedescendant={results[active] ? `palette-option-${results[active].id}` : undefined}
				aria-label="Buscar links, apps, posts, notas e comandos"
				autocomplete="off"
			/>
			<button type="button" class="palette-close" aria-label="Fechar busca" onclick={onclose}>
				<Icon name="x" size={16} />
			</button>
		</div>

		<ul id="palette-list" class="palette-list" role="listbox" aria-label="Resultados">
			{#each results as entry, index (entry.id)}
				<li
					id={`palette-option-${entry.id}`}
					class="palette-item"
					class:active={index === active}
					role="option"
					aria-selected={index === active}
					onmousedown={(event) => {
						event.preventDefault();
						void choose(entry);
					}}
					onmouseenter={() => (active = index)}
				>
					<span
						class="item-avatar"
						style="background: {tint(entry.color, 0.16)}; color: {entry.color}"
					>
						{entry.type === 'category'
							? entry.title.slice(0, 1).toUpperCase()
							: initials(entry.title)}
					</span>
					<span class="palette-meta">
						<span class="palette-name">{entry.title}</span>
						<span class="palette-desc">{entry.description}</span>
					</span>
					<span class="palette-kind">{typeLabel(entry)}</span>
				</li>
			{/each}
			{#if results.length === 0}
				<li class="palette-empty" role="presentation">Nada encontrado para "{query}".</li>
			{/if}
		</ul>

		<div class="palette-hint">↑ ↓ navegar · Enter abrir · &gt; comandos · Esc fechar</div>
	</div>
</div>
