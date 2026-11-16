/** Registra a abertura de um item sem bloquear a navegação. */
export function trackItemOpen(id: string): void {
	if (!id) return;
	try {
		void fetch('/api/usage', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ id }),
			keepalive: true
		}).catch(() => undefined);
	} catch {
		// histórico é opcional: falha não pode impedir o link
	}
}
