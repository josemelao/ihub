class UiState {
	paletteOpen = $state(false);
	quickAddOpen = $state(false);
	navOpen = $state(false);

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

	openNav(): void {
		this.navOpen = true;
	}

	closeNav(): void {
		this.navOpen = false;
	}

	toggleNav(): void {
		this.navOpen = !this.navOpen;
	}
}

export const ui = new UiState();
