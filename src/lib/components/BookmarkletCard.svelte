<script lang="ts">
	import { page } from '$app/state';
	import { buildBookmarklet } from '#lib/bookmarklet';
	import Icon from './Icon.svelte';

	let copied = $state(false);
	const bookmarklet = $derived(buildBookmarklet(page.url.origin));

	async function copy(): Promise<void> {
		try {
			await navigator.clipboard.writeText(bookmarklet);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			copied = false;
		}
	}
</script>

<div class="panel section">
	<div class="section-head">
		<h2 style="font-size: 16px">Salvar a página atual</h2>
	</div>
	<p class="muted small">
		Arraste o botão abaixo para a barra de favoritos. Depois, em qualquer site, clique nele para
		abrir o editor já com a URL e o título da página.
	</p>
	<div class="chips">
		<a
			class="btn btn-primary"
			href={bookmarklet}
			draggable="true"
			title="Arraste para a barra de favoritos"
			onclick={(event) => event.preventDefault()}
		>
			<Icon name="bookmark" size={16} />
			Salvar no Hub
		</a>
		<button class="btn" type="button" onclick={copy} aria-live="polite">
			{copied ? 'Copiado!' : 'Copiar código'}
		</button>
	</div>
	<p class="muted small">
		Se o site bloquear bookmarklets (CSP), copie a URL e use “Adicionar rápido”.
	</p>
</div>
