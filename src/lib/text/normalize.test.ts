import { describe, expect, it } from 'vitest';
import { findSnippet, normalize, normalizeWithMap } from './normalize';

describe('normalize', () => {
	it('remove acentos e caixa', () => {
		expect(normalize('Café À Noite')).toBe('cafe a noite');
	});

	it('mapeia cada caractere normalizado para o original', () => {
		const { normalized, map } = normalizeWithMap('Ação');
		expect(normalized).toBe('acao');
		expect(map[0]).toBe(0);
		expect(map[1]).toBe(1);
		expect(map[3]).toBe(3);
	});
});

describe('findSnippet', () => {
	const text = 'O novo patch corrige o dano do Flamethrower e ajusta a economia do jogo inteiro.';

	it('acha sem diferenciar acento ou caixa e preserva a grafia original', () => {
		expect(findSnippet(text, ['flamethrower'])).toEqual({
			before: 'O novo patch corrige o dano do ',
			match: 'Flamethrower',
			after: ' e ajusta a economia do jogo inteiro.'
		});
	});

	it('monta janela com reticências quando o texto é longo', () => {
		const long = `${'a'.repeat(120)} alvo ${'b'.repeat(120)}`;
		const snippet = findSnippet(long, ['alvo'], 40);
		expect(snippet?.match).toBe('alvo');
		expect(snippet?.before.startsWith('…')).toBe(true);
		expect(snippet?.after.endsWith('…')).toBe(true);
		expect((snippet?.before.length ?? 0) < 60).toBe(true);
	});

	it('devolve null quando o termo não existe', () => {
		expect(findSnippet(text, ['inexistente'])).toBeNull();
	});

	it('mantém as palavras seguintes dentro da janela', () => {
		const long = `${'antes '.repeat(20)}alvo ${'depois '.repeat(20)}`;
		const snippet = findSnippet(long, ['alvo'], 30);
		expect(snippet?.after).toContain('depois');
	});

	it('ignora termos vazios', () => {
		expect(findSnippet(text, ['  '])).toBeNull();
	});

	it('escolhe a primeira ocorrência entre vários termos', () => {
		const snippet = findSnippet(text, ['economia', 'patch']);
		expect(snippet?.match).toBe('patch');
	});
});
