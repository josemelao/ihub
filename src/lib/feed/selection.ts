export type SelectionMode = 'toggle' | 'range';

export interface SelectionUpdate {
	selected: string[];
	anchor: string | null;
}

export function updateSelection(
	selected: string[],
	id: string,
	options: { visibleIds: string[]; anchor: string | null; mode: SelectionMode }
): SelectionUpdate {
	const next = new Set(selected);

	if (options.mode === 'range' && options.anchor) {
		const anchorIndex = options.visibleIds.indexOf(options.anchor);
		const targetIndex = options.visibleIds.indexOf(id);

		if (anchorIndex >= 0 && targetIndex >= 0) {
			const start = Math.min(anchorIndex, targetIndex);
			const end = Math.max(anchorIndex, targetIndex);
			return {
				selected: options.visibleIds.slice(start, end + 1),
				anchor: options.anchor
			};
		}
	}

	if (next.has(id)) next.delete(id);
	else next.add(id);

	return { selected: [...next], anchor: id };
}

export function selectAll(ids: string[]): string[] {
	return [...new Set(ids)];
}

export function pruneSelection(selected: string[], visibleIds: string[]): string[] {
	const visible = new Set(visibleIds);
	return selected.filter((id) => visible.has(id));
}
