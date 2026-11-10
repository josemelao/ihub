import { describe, expect, it } from 'vitest';
import {
	registerBackdropPointerDown,
	resetBackdropPointer,
	shouldCloseOnBackdropClick,
	type BackdropPointerState
} from './dialog-backdrop';

const dialog = {} as Element;
const input = {} as Element;

function state(): BackdropPointerState {
	return { pointerDownOnBackdrop: false };
}

describe('fechamento do modal pelo backdrop', () => {
	it('fecha quando o clique começa e termina no backdrop', () => {
		const current = state();
		registerBackdropPointerDown(current, dialog, dialog);
		expect(shouldCloseOnBackdropClick(current, dialog, dialog)).toBe(true);
	});

	it('não fecha quando a seleção começa dentro e termina fora', () => {
		const current = state();
		registerBackdropPointerDown(current, input, dialog);
		expect(shouldCloseOnBackdropClick(current, dialog, dialog)).toBe(false);
	});

	it('não fecha quando o clique começa fora e termina dentro', () => {
		const current = state();
		registerBackdropPointerDown(current, dialog, dialog);
		expect(shouldCloseOnBackdropClick(current, input, dialog)).toBe(false);
	});

	it('não fecha quando um clique normal acontece dentro do conteúdo', () => {
		const current = state();
		registerBackdropPointerDown(current, input, dialog);
		expect(shouldCloseOnBackdropClick(current, input, dialog)).toBe(false);
	});

	it('esquece o estado após o clique ou cancelamento', () => {
		const current = state();
		registerBackdropPointerDown(current, dialog, dialog);
		expect(shouldCloseOnBackdropClick(current, input, dialog)).toBe(false);
		expect(shouldCloseOnBackdropClick(current, dialog, dialog)).toBe(false);

		registerBackdropPointerDown(current, dialog, dialog);
		resetBackdropPointer(current);
		expect(shouldCloseOnBackdropClick(current, dialog, dialog)).toBe(false);
	});
});
