class UiState {
	paletteOpen = $state(false);

	openPalette(): void {
		this.paletteOpen = true;
	}

	closePalette(): void {
		this.paletteOpen = false;
	}
}

export const ui = new UiState();
