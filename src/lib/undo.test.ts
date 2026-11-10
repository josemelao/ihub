import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearUndoBatch, loadUndoBatch, saveUndoBatch } from './undo';

class MemoryStorage implements Storage {
	private data = new Map<string, string>();

	get length(): number {
		return this.data.size;
	}

	clear(): void {
		this.data.clear();
	}

	getItem(key: string): string | null {
		return this.data.get(key) ?? null;
	}

	key(index: number): string | null {
		return [...this.data.keys()][index] ?? null;
	}

	removeItem(key: string): void {
		this.data.delete(key);
	}

	setItem(key: string, value: string): void {
		this.data.set(key, value);
	}
}

beforeEach(() => {
	vi.stubGlobal('sessionStorage', new MemoryStorage());
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('undo batch', () => {
	it('salva e carrega ids dentro da validade', () => {
		const batch = saveUndoBatch(['a', 'b'], 30_000, 1_000);
		expect(loadUndoBatch(2_000)).toEqual(batch);
	});

	it('ignora lote expirado e limpa o storage', () => {
		saveUndoBatch(['a'], 1_000, 1_000);
		expect(loadUndoBatch(2_500)).toBeNull();
	});

	it('limpa o lote manualmente', () => {
		saveUndoBatch(['a'], 30_000, 1_000);
		clearUndoBatch();
		expect(loadUndoBatch(2_000)).toBeNull();
	});
});
