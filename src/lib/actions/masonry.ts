export interface MasonryOptions {
	enabled?: boolean;
	gap?: number;
}

export interface MasonryPosition {
	left: number;
	top: number;
	width: number;
	height: number;
}

export function columnsForWidth(width: number): number {
	if (width >= 1000) return 3;
	if (width >= 620) return 2;
	return 1;
}

export function computeMasonryLayout(
	heights: number[],
	columns: number,
	columnWidth: number,
	gap: number
): { positions: MasonryPosition[]; height: number } {
	const safeColumns = Math.max(1, columns);
	const columnHeights = Array.from({ length: safeColumns }, () => 0);

	const positions = heights.map((height) => {
		let column = 0;
		for (let index = 1; index < columnHeights.length; index += 1) {
			if (columnHeights[index] < columnHeights[column]) column = index;
		}

		const left = column * (columnWidth + gap);
		const top = columnHeights[column];
		columnHeights[column] = top + height + gap;

		return { left, top, width: columnWidth, height };
	});

	const tallest = columnHeights.length > 0 ? Math.max(...columnHeights) : 0;
	return { positions, height: tallest > 0 ? tallest - gap : 0 };
}

export function masonry(node: HTMLElement, options: MasonryOptions = {}) {
	let opts: Required<MasonryOptions> = { enabled: true, gap: 12, ...options };
	let frame = 0;
	let observer: ResizeObserver | null = null;
	let mutation: MutationObserver | null = null;

	function clear(): void {
		for (const child of Array.from(node.children)) {
			const element = child as HTMLElement;
			element.style.position = '';
			element.style.left = '';
			element.style.top = '';
			element.style.width = '';
		}
		node.style.height = '';
		node.classList.remove('masonry-ready');
	}

	function measure(): void {
		if (!opts.enabled) {
			clear();
			return;
		}

		const width = node.clientWidth;
		if (width <= 0) return;

		const columns = columnsForWidth(width);
		const columnWidth = (width - opts.gap * (columns - 1)) / columns;
		const children = Array.from(node.children) as HTMLElement[];

		for (const child of children) {
			child.style.position = 'absolute';
			child.style.width = `${columnWidth}px`;
			child.style.left = '0px';
			child.style.top = '0px';
		}

		const heights = children.map((child) => child.offsetHeight);
		const layout = computeMasonryLayout(heights, columns, columnWidth, opts.gap);

		children.forEach((child, index) => {
			const position = layout.positions[index];
			child.style.left = `${position.left}px`;
			child.style.top = `${position.top}px`;
		});

		node.style.height = `${layout.height}px`;
		node.classList.add('masonry-ready');
	}

	function schedule(): void {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(measure);
	}

	function observeChildren(): void {
		observer?.disconnect();
		observer = new ResizeObserver(schedule);
		observer.observe(node);
		for (const child of node.children) {
			observer.observe(child);
		}
		schedule();
	}

	if (typeof ResizeObserver !== 'undefined') {
		observer = new ResizeObserver(schedule);
		observer.observe(node);
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
