/**
 * Backoff reativo por host: depois de um 429, ninguém mais fala com aquele
 * host até o prazo acabar. O Reddit, por exemplo, libera de novo em ~1 minuto,
 * mas insistir durante o bloqueio só estende a punição.
 *
 * O estado é de processo (não persiste): reiniciar o servidor libera o host,
 * o que é aceitável porque o limite é do lado remoto, não nosso.
 */

const DEFAULT_BLOCK_MS = 5 * 60_000;
const MAX_BLOCK_MS = 60 * 60_000;

interface HostState {
	blockedUntil: number;
	strikes: number;
}

const hosts = new Map<string, HostState>();

export function hostKey(input: string | URL): string {
	const url = input instanceof URL ? input : new URL(input);
	return url.hostname.toLowerCase().replace(/^www\./, '');
}

/** Milissegundos restantes de bloqueio (0 = liberado). */
export function blockedFor(input: string | URL, now = Date.now()): number {
	const key = hostKey(input);
	const state = hosts.get(key);
	if (!state) return 0;
	const remaining = state.blockedUntil - now;
	if (remaining <= 0) {
		state.blockedUntil = 0;
		return 0;
	}
	return remaining;
}

/**
 * Registra um 429 e devolve quanto tempo o host fica de fora. Sem
 * `Retry-After` começa em 5 min e dobra a cada reincidência (teto de 1 h).
 */
export function noteRateLimited(
	input: string | URL,
	retryAfterMs: number | null = null,
	now = Date.now()
): number {
	const key = hostKey(input);
	const state = hosts.get(key) ?? { blockedUntil: 0, strikes: 0 };
	state.strikes += 1;
	const base = retryAfterMs && retryAfterMs > 0 ? retryAfterMs : DEFAULT_BLOCK_MS;
	const wait = Math.min(base * 2 ** (state.strikes - 1), MAX_BLOCK_MS);
	state.blockedUntil = now + wait;
	hosts.set(key, state);
	return wait;
}

/** Uma resposta 2xx zera o histórico de bloqueios do host. */
export function noteHostSuccess(input: string | URL): void {
	const state = hosts.get(hostKey(input));
	if (!state) return;
	state.blockedUntil = 0;
	state.strikes = 0;
}

/** Usado pelos testes: o estado é global de propósito, mas precisa ser isolável. */
export function resetHostGate(): void {
	hosts.clear();
}

export function rateLimitMessage(waitMs: number): string {
	const minutes = Math.max(1, Math.ceil(waitMs / 60_000));
	return `O site limitou temporariamente as requisições (429). Nova tentativa em ${minutes} min.`;
}
