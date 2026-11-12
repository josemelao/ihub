import type { HighlightColor } from '../types';

// Módulo client-safe: nada de `node:*` aqui. Componentes de interface importam
// estas constantes; a lógica que usa hash fica em `highlights.ts` (servidor).
export const HIGHLIGHT_COLORS: HighlightColor[] = ['yellow', 'green', 'blue', 'pink'];

export const HIGHLIGHT_COLOR_LABELS: Record<HighlightColor, string> = {
	yellow: 'amarelo',
	green: 'verde',
	blue: 'azul',
	pink: 'rosa'
};

export const MAX_HIGHLIGHT_QUOTE_LENGTH = 2_000;
export const MAX_HIGHLIGHT_NOTE_LENGTH = 2_000;
