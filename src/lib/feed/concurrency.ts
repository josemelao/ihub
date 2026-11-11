/**
 * Executa `fn` para todos os itens com no máximo `limit` tarefas em voo,
 * devolvendo os resultados na mesma ordem da entrada.
 */
export async function mapWithConcurrency<T, R>(
	items: T[],
	limit: number,
	fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
	const results = new Array<R>(items.length);
	let next = 0;
	let failure: { error: unknown } | null = null;

	const worker = async (): Promise<void> => {
		while (!failure) {
			const index = next;
			next += 1;
			if (index >= items.length) return;
			try {
				results[index] = await fn(items[index], index);
			} catch (error) {
				failure = { error };
				return;
			}
		}
	};

	const size = Math.max(1, Math.min(limit, items.length));
	await Promise.all(Array.from({ length: size }, worker));

	if (failure) throw (failure as { error: unknown }).error;
	return results;
}
