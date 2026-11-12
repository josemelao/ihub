import { describe, expect, it } from 'vitest';
import { formatUnreadTitle, shouldNotify } from './notifications';

describe('formatUnreadTitle', () => {
	it('prefixa a contagem quando há não lidos', () => {
		expect(formatUnreadTitle(3)).toBe('(3) Meu Hub');
	});

	it('sem não lidos usa o título simples', () => {
		expect(formatUnreadTitle(0)).toBe('Meu Hub');
	});

	it('funciona em telas internas', () => {
		expect(formatUnreadTitle(1, 'Feed')).toBe('(1) Feed · Meu Hub');
	});
});

describe('shouldNotify', () => {
	const base = {
		previous: 2,
		current: 5,
		permission: 'granted' as NotificationPermission,
		hidden: true,
		enabled: true
	};

	it('notifica quando aumentou, está oculto e permitido', () => {
		expect(shouldNotify(base)).toBe(true);
	});

	it('não notifica sem novos posts', () => {
		expect(shouldNotify({ ...base, current: 2 })).toBe(false);
	});

	it('não notifica com a aba visível', () => {
		expect(shouldNotify({ ...base, hidden: false })).toBe(false);
	});

	it('não notifica sem permissão', () => {
		expect(shouldNotify({ ...base, permission: 'denied' })).toBe(false);
	});

	it('não notifica quando o usuário desligou', () => {
		expect(shouldNotify({ ...base, enabled: false })).toBe(false);
	});

	it('não notifica na primeira carga (sem contagem anterior)', () => {
		expect(shouldNotify({ ...base, previous: null })).toBe(false);
	});

	it('não notifica posts já lidos (contagem caiu)', () => {
		expect(shouldNotify({ ...base, current: 1 })).toBe(false);
	});
});
