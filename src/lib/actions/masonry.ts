export function spanForHeight(height: number, rowHeight: number, gap: number): number {
	if (!Number.isFinite(height) || height <= 0) return 1;
	return Math.max(1, Math.ceil((height + gap) / (rowHeight + gap)));
}

export interface MasonryOptions {
	enabled?: boolean;
	rowHeight?: number;
	gap?: number;
}

export function masonry(node: HTMLElement, options: MasonryOptions = {}) {
	let opts: Required<MasonryOptions> = {
		enabled: true,
		rowHeight: 8,
		gap: 12,
		...options
	};

	let frame = 0;
	let observer: ResizeObserver | null = null;
	let mutation: MutationObserver | null = null;

	function clear(): void {
		for (const child of Array.from(node.children)) {
			(child as HTMLElement).style.gridRowEnd = '';
		}
		node.classList.remove('masonry-ready');
	}

	function measure(): void {
		if (!opts.enabled) {
			clear();
			return;
		}

		const children = Array.from(node.children) as HTMLElement[];
		for (const child of children) {
			child.style.gridRowEnd = 'auto';
		}

		for (const child of children) {
			const height = child.getBoundingClientRect().height;
			child.style.gridRowEnd = `span ${spanForHeight(height, opts.rowHeight, opts.gap)}`;
		}

		node.classList.add('masonry-ready');
	}

	function schedule(): void {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(measure);
	}

	function observeChildren(): void {
		observer?.disconnect();
		observer = new ResizeObserver(schedule);
		for (const child of node.children) {
			observer.observe(child);
		}
		schedule();
	}

	if (typeof ResizeObserver !== 'undefined') {
		observer = new ResizeObserver(schedule);
		for (const child of node.children) {
			observer.observe(child);
		}
	}

	mutation = new MutationObserver(observeChildren);
	mutation.observe(node, { childList: true });
	schedule();

	return {
		update(next: MasonryOptions = {}): void {
			opts = { ...opts, ...next };
			observeChildren();
		},
		destroy(): void {
			cancelAnimationFrame(frame);
			observer?.disconnect();
			mutation?.disconnect();
		}
	};
}
