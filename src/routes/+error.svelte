<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status} · Meu Hub</title>
</svelte:head>

<div class="section">
	<h1>{page.status}</h1>
	<p class="muted">
		{page.error?.message ?? 'Algo deu errado ao carregar esta página.'}
	</p>
	<a class="btn" href={resolve('/')} style="align-self: flex-start">Voltar ao início</a>
</div>
