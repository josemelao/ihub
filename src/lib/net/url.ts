export function toSafeHttpUrl(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	if (!trimmed) return null;

	try {
		const url = new URL(trimmed);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
		return url.toString();
	} catch {
		return null;
	}
}

export function assertSafeHttpUrl(value: unknown, label = 'URL'): string {
	const safe = toSafeHttpUrl(value);
	if (!safe) throw new Error(`${label} inválida: use http:// ou https://`);
	return safe;
}

export function isSafeHttpUrl(value: unknown): boolean {
	return toSafeHttpUrl(value) !== null;
}
