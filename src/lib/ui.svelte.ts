class UiState {
	paletteOpen = $state(false);
	quickAddOpen = $state(false);

	openPalette(): void {
		this.paletteOpen = true;
	}

	closePalette(): void {
		this.paletteOpen = false;
	}

	openQuickAdd(): void {
		this.quickAddOpen = true;
	}

	closeQuickAdd(): void {
		this.quickAddOpen = false;
	}
}

export const ui = new UiState();
