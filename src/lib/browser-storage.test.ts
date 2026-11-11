import { describe, expect, it, afterEach } from 'vitest';
import { readLocal, writeLocal, removeLocal } from './browser-storage';

const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

function useStorage(value: unknown): void {
	Object.defineProperty(globalThis, 'localStorage', {
		value,
		configurable: true,
		writable: true
	});
}

afterEach(() => {
	if (original) Object.defineProperty(globalThis, 'localStorage', original);
	else Reflect.deleteProperty(globalThis, 'localStorage');
});

describe('browser storage seguro', () => {
	it('lê e grava quando o storage funciona', () => {
		const data = new Map<string, string>();
		useStorage({
			getItem: (key: string) => data.get(key) ?? null,
			setItem: (key: string, value: string) => data.set(key, value),
			removeItem: (key: string) => data.delete(key)
		});

		expect(writeLocal('k', 'v')).toBe(true);
		expect(readLocal('k')).toBe('v');
		removeLocal('k');
		expect(readLocal('k')).toBeNull();
	});

	it('não quebra quando o getItem lança', () => {
		useStorage({
			getItem: () => {
				throw new Error('bloqueado');
			},
			setItem: () => undefined,
			removeItem: () => undefined
		});

		expect(readLocal('k')).toBeNull();
	});

	it('não quebra quando o setItem lança', () => {
		useStorage({
			getItem: () => null,
			setItem: () => {
				throw new Error('sem cota');
			},
			removeItem: () => undefined
		});

		expect(writeLocal('k', 'v')).toBe(false);
	});

	it('não quebra quando não existe storage', () => {
		Reflect.deleteProperty(globalThis, 'localStorage');

		expect(readLocal('k')).toBeNull();
		expect(writeLocal('k', 'v')).toBe(false);
	});
});
