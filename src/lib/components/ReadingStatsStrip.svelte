<script lang="ts">
	import type { ReadingStats } from '#lib/reader/stats';

	let { stats }: { stats: ReadingStats } = $props();

	const savedLabel = $derived(stats.saved === 1 ? 'salvo' : 'salvos');
	const readLabel = $derived(stats.read === 1 ? 'lido' : 'lidos');
	const archivedLabel = $derived(stats.archived === 1 ? 'arquivado' : 'arquivados');
	const highlightLabel = $derived(stats.highlights === 1 ? 'destaque' : 'destaques');
	const coverage = $derived(
		stats.withText > 0
			? `Baseado em ${stats.withText} de ${stats.saved} salvos com texto extraído`
			: 'Nenhum salvo com texto extraído ainda'
	);
</script>

<section class="saved-stats" aria-label="Estatísticas dos salvos">
	<span class="saved-stat" data-stat="saved">
		<span class="saved-stat-value">{stats.saved}</span>
		<span class="saved-stat-label">{savedLabel}</span>
	</span>
	<span class="saved-stat" data-stat="read">
		<span class="saved-stat-value">{stats.read}</span>
		<span class="saved-stat-label">{readLabel}</span>
	</span>
	<span class="saved-stat" data-stat="archived">
		<span class="saved-stat-value">{stats.archived}</span>
		<span class="saved-stat-label">{archivedLabel}</span>
	</span>
	<span class="saved-stat" data-stat="highlights">
		<span class="saved-stat-value">{stats.highlights}</span>
		<span class="saved-stat-label">{highlightLabel}</span>
	</span>
	<span class="saved-stat" data-stat="minutes" title={coverage}>
		<span class="saved-stat-value">~{stats.minutes} min</span>
		<span class="saved-stat-label">de leitura</span>
	</span>
</section>
