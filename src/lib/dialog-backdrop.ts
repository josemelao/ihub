export interface BackdropPointerState {
	pointerDownOnBackdrop: boolean;
}

export function registerBackdropPointerDown(
	state: BackdropPointerState,
	target: EventTarget | null,
	dialog: Element | null
): void {
	state.pointerDownOnBackdrop = target === dialog;
}

export function shouldCloseOnBackdropClick(
	state: BackdropPointerState,
	target: EventTarget | null,
	dialog: Element | null
): boolean {
	const shouldClose = state.pointerDownOnBackdrop && target === dialog;
	state.pointerDownOnBackdrop = false;
	return shouldClose;
}

export function resetBackdropPointer(state: BackdropPointerState): void {
	state.pointerDownOnBackdrop = false;
}
