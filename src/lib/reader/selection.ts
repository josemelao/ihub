export interface SelectionInfo {
	quote: string;
	occurrence: number;
}

export const MAX_SELECTION_LENGTH = 2_000;

/**
 * Normaliza a seleção e calcula o ordinal da ocorrência do trecho no texto do
 * artigo (0-based), para distinguir trechos idênticos.
 */
export function buildSelectionInfo(
	selectedText: string,
	articleText: string,
	startIndex = 0
): SelectionInfo | null {
	const quote = selectedText.replace(/\s+/g, ' ').trim();
	if (!quote || quote.length > MAX_SELECTION_LENGTH) return null;

	let occurrence = 0;
	if (startIndex > 0) {
		let from = 0;
		while (from < startIndex) {
			const found = articleText.indexOf(quote, from);
			if (found === -1 || found >= startIndex) break;
			occurrence += 1;
			from = found + quote.length;
		}
	}

	return { quote, occurrence };
}
