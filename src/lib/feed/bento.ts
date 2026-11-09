const IMAGE_SPANS = [4, 3, 2, 3];
const TEXT_SPANS = [2, 3];

export function assignBentoSpans(entries: { hasImage: boolean }[]): number[] {
	let imageIndex = 0;
	let textIndex = 0;

	return entries.map((entry) => {
		if (entry.hasImage) {
			const span = IMAGE_SPANS[imageIndex % IMAGE_SPANS.length];
			imageIndex += 1;
			return span;
		}

		const span = TEXT_SPANS[textIndex % TEXT_SPANS.length];
		textIndex += 1;
		return span;
	});
}
