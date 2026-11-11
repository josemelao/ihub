/**
 * Gera o bookmarklet que abre o Gerenciar com a URL e o título da aba atual.
 * O código roda no site visitado, não no app; por isso usa apenas APIs do navegador.
 */
export function buildBookmarklet(baseUrl: string): string {
	let base: string;
	try {
		base = new URL(baseUrl).origin;
	} catch {
		base = baseUrl.replace(/\/+$/, '');
	}

	const target = `${base}/gerenciar?tab=itens&add=link`;
	return `javascript:(()=>{const u=location.href,t=document.title||u;window.open('${target}&url='+encodeURIComponent(u)+'&name='+encodeURIComponent(t),'_blank');})()`;
}
