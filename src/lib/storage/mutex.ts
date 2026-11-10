/**
 * Fila de execução por chave.
 *
 * O lock é por processo: protege requisições concorrentes do mesmo servidor
 * Node, mas não dois processos abrindo o mesmo arquivo (ver PLAT-04).
 */
export class Mutex {
	private tail: Promise<unknown> = Promise.resolve();

	run<T>(fn: () => Promise<T> | T): Promise<T> {
		const result = this.tail.then(fn, fn);
		this.tail = result.then(
			() => undefined,
			() => undefined
		);
		return result;
	}
}

export interface LockRegistry {
	withLock<T>(key: string, fn: () => Promise<T> | T): Promise<T>;
	withLocks<T>(keys: string[], fn: () => Promise<T> | T): Promise<T>;
}

export function createLockRegistry(): LockRegistry {
	const mutexes = new Map<string, Mutex>();

	function mutexFor(key: string): Mutex {
		let mutex = mutexes.get(key);
		if (!mutex) {
			mutex = new Mutex();
			mutexes.set(key, mutex);
		}
		return mutex;
	}

	function withLock<T>(key: string, fn: () => Promise<T> | T): Promise<T> {
		return mutexFor(key).run(fn);
	}

	function withLocks<T>(keys: string[], fn: () => Promise<T> | T): Promise<T> {
		// Ordem estável evita deadlock quando duas transações pedem as mesmas
		// chaves em ordens diferentes. Os locks são aninhados: a chave anterior
		// fica presa enquanto a próxima é adquirida.
		const ordered = [...new Set(keys)].sort();

		function acquire(index: number): Promise<T> {
			if (index >= ordered.length) return Promise.resolve(fn());
			return mutexFor(ordered[index]).run(() => acquire(index + 1));
		}

		return acquire(0);
	}

	return { withLock, withLocks };
}
