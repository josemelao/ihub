const BASE_TITLE = 'Meu Hub';

/** Título da aba com a contagem de não lidos (ex.: "(3) Meu Hub"). */
export function formatUnreadTitle(count: number, page?: string): string {
	const safe = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
	if (safe === 0) return page ? `${page} · ${BASE_TITLE}` : BASE_TITLE;
	return page ? `(${safe}) ${page} · ${BASE_TITLE}` : `(${safe}) ${BASE_TITLE}`;
}

export interface NotifyInput {
	previous: number | null;
	current: number;
	permission: NotificationPermission;
	hidden: boolean;
	enabled: boolean;
}

/** Notifica só quando chegaram posts novos, com a aba oculta e permissão dada. */
export function shouldNotify(input: NotifyInput): boolean {
	if (!input.enabled) return false;
	if (input.permission !== 'granted') return false;
	if (!input.hidden) return false;
	if (input.previous === null) return false;
	return input.current > input.previous;
}

/**
 * Desenha a contagem sobre um favicon quadrado. Retorna `null` fora do
 * navegador (SSR/testes) ou quando o canvas não está disponível.
 */
export function faviconBadgeDataUrl(count: number, size = 64): string | null {
	if (typeof document === 'undefined') return null;
	const safe = Math.max(0, Math.trunc(count));
	if (safe === 0) return null;

	try {
		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		const context = canvas.getContext('2d');
		if (!context) return null;

		context.fillStyle = '#0f1115';
		context.fillRect(0, 0, size, size);
		context.fillStyle = '#8aa4ff';
		context.beginPath();
		context.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2);
		context.fill();

		context.fillStyle = '#0b1020';
		context.font = `bold ${safe > 99 ? size * 0.34 : size * 0.46}px system-ui, sans-serif`;
		context.textAlign = 'center';
		context.textBaseline = 'middle';
		context.fillText(safe > 99 ? '99+' : String(safe), size / 2, size / 2 + size * 0.02);

		return canvas.toDataURL('image/png');
	} catch {
		return null;
	}
}
