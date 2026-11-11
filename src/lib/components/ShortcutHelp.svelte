<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import Icon from './Icon.svelte';

	let { onclose }: { onclose: () => void } = $props();

	let dialogEl = $state<HTMLDialogElement | null>(null);

	onMount(() => {
		dialogEl?.showModal();
	});

	onDestroy(() => {
		dialogEl?.close();
	});

	function cancel(event: Event): void {
		event.preventDefault();
		onclose();
	}
</script>

<dialog class="confirm-dialog" aria-label="Atalhos do feed" oncancel={cancel} bind:this={dialogEl}>
	<div class="confirm-body">
		<div class="confirm-head">
			<h2>Atalhos do feed</h2>
			<button type="button" class="palette-close" aria-label="Fechar" onclick={onclose}>
				<Icon name="x" size={16} />
			</button>
		</div>

		<ul class="shortcut-list">
			<li><kbd>j</kbd> / <kbd>k</kbd><span>próximo / anterior card</span></li>
			<li><kbd>m</kbd><span>marcar lido / não lido</span></li>
			<li><kbd>s</kbd><span>salvar / remover dos salvos</span></li>
			<li><kbd>o</kbd> ou <kbd>Enter</kbd><span>abrir o post</span></li>
			<li><kbd>?</kbd><span>mostrar esta ajuda</span></li>
			<li><kbd>Esc</kbd><span>sair da seleção / limpar foco</span></li>
		</ul>

		<div class="confirm-actions">
			<button class="btn" type="button" onclick={onclose}>Fechar</button>
		</div>
	</div>
</dialog>
