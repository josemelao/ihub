export interface SnippetParts {
	before: string;
	match: string;
	after: string;
}

export function normalize(text: string): string {
	return text
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase();
}

/**
 * Normaliza mantendo o mapa de cada caractere normalizado para o índice no
 * texto original. É o que permite destacar um trecho sem perder acentos.
 */
export function normalizeWithMap(text: string): { normalized: string; map: number[] } {
	let normalized = '';
	const map: number[] = [];

	for (let index = 0; index < text.length; index += 1) {
		const chars = text[index]
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase();
		for (let position = 0; position < chars.length; position += 1) {
			normalized += chars[position];
			map.push(index);
		}
	}

	return { normalized, map };
}

/**
 * Encontra o primeiro termo no texto (sem acento/caixa) e devolve uma janela
 * com o trecho original, cortada em limites de palavra quando possível.
 */
export function findSnippet(text: string, terms: string[], radius = 80): SnippetParts | null {
	const { normalized, map } = normalizeWithMap(text);
	let start = -1;
	let end = -1;

	for (const raw of terms) {
		const term = normalize(raw).trim();
		if (!term) continue;
		const index = normalized.indexOf(term);
		if (index >= 0 && (start < 0 || index < start)) {
			start = index;
			end = index + term.length;
		}
	}

	if (start < 0) return null;

	const originalStart = map[start];
	const originalEnd = (map[end - 1] ?? originalStart) + 1;

	let from = Math.max(0, originalStart - radius);
	let to = Math.min(text.length, originalEnd + radius);

	if (from > 0) {
		const space = text.lastIndexOf(' ', originalStart);
		if (space >= from) from = space + 1;
	}
	if (to < text.length) {
		const cut = text.lastIndexOf(' ', to);
		if (cut > originalEnd) to = cut;
	}

	const before = text.slice(from, originalStart);
	const after = text.slice(originalEnd, to);

	return {
		before: `${from > 0 ? '…' : ''}${before.trimStart()}`,
		match: text.slice(originalStart, originalEnd),
		after: `${after.trimEnd()}${to < text.length ? '…' : ''}`
	};
}
