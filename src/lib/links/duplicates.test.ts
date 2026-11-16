import { describe, expect, it } from 'vitest';
import type { HubItem } from '../types';
import { duplicateItemIds, findDuplicateGroups, normalizeLinkUrl } from './duplicates';

function link(id: string, url: string): HubItem {
	return {
		id,
		type: 'link',
		name: `Link ${id}`,
		url,
		categoryId: 'cat',
		order: 1,
		pinned: false,
		tags: []
	};
}

function app(id: string, launchValue: string): HubItem {
	return {
		id,
		type: 'app',
		name: `App ${id}`,
		launch: { kind: 'protocol', value: launchValue },
		categoryId: 'cat',
		order: 1,
		pinned: false,
		tags: []
	};
}

describe('normalizeLinkUrl', () => {
	it('ignora caixa do host, www, barra final, hash, tracking e ordem da query', () => {
		expect(
			normalizeLinkUrl('https://www.GitHub.com/user/?utm_source=x&b=2&a=1#top')
		).toBe('https://github.com/user?a=1&b=2');
	});

	it('trata raiz com e sem barra como o mesmo endereço', () => {
		expect(normalizeLinkUrl('https://example.com')).toBe('https://example.com/');
		expect(normalizeLinkUrl('https://example.com/')).toBe('https://example.com/');
	});

	it('mantém caminhos diferentes separados', () => {
		expect(normalizeLinkUrl('https://example.com/A')).not.toBe(
			normalizeLinkUrl('https://example.com/a')
		);
	});

	it('remove portas padrão e rejeita esquemas/credenciais inválidas', () => {
		expect(normalizeLinkUrl('http://example.com:80/x')).toBe('http://example.com/x');
		expect(normalizeLinkUrl('ftp://example.com/x')).toBeNull();
		expect(normalizeLinkUrl('https://user:senha@example.com/')).toBeNull();
		expect(normalizeLinkUrl('nao-e-url')).toBeNull();
	});
});

describe('findDuplicateGroups', () => {
	it('agrupa só links com a mesma URL normalizada', () => {
		const items = [
			link('a', 'https://example.com/x?utm_source=news'),
			link('b', 'https://www.example.com/x/'),
			link('c', 'https://example.com/y'),
			app('d', 'steam://open/main')
		];

		const groups = findDuplicateGroups(items);

		expect(groups).toHaveLength(1);
		expect(groups[0].key).toBe('https://example.com/x');
		expect(groups[0].items.map((item) => item.id)).toEqual(['a', 'b']);
		expect([...duplicateItemIds(groups)]).toEqual(['a', 'b']);
	});

	it('ignora URLs inválidas e não cria grupo para item único', () => {
		const groups = findDuplicateGroups([
			link('a', 'nao-e-url'),
			link('b', 'https://example.com/unico')
		]);

		expect(groups).toEqual([]);
	});
});
