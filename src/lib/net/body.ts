export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Erros que indicam bug nosso, não payload errado: a mensagem não vai ao cliente. */
export function isInternalError(error: unknown): boolean {
	return (
		error instanceof TypeError ||
		error instanceof ReferenceError ||
		error instanceof RangeError ||
		error instanceof SyntaxError
	);
}

export class RequestBodyError extends Error {
	readonly status: number;

	constructor(message: string, status = 400) {
		super(message);
		this.name = 'RequestBodyError';
		this.status = status;
	}
}

export async function readJsonLimited(request: Request, maxBytes: number): Promise<unknown> {
	const lengthHeader = request.headers.get('content-length');
	if (lengthHeader) {
		const length = Number(lengthHeader);
		if (Number.isFinite(length) && length > maxBytes) {
			throw new RequestBodyError('Corpo da requisição muito grande.', 413);
		}
	}

	if (!request.body) {
		throw new RequestBodyError('Corpo da requisição vazio.');
	}

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let received = 0;

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (!value) continue;
			received += value.byteLength;
			if (received > maxBytes) {
				await reader.cancel().catch(() => undefined);
				throw new RequestBodyError('Corpo da requisição muito grande.', 413);
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}

	const merged = new Uint8Array(received);
	let offset = 0;
	for (const chunk of chunks) {
		merged.set(chunk, offset);
		offset += chunk.byteLength;
	}

	try {
		return JSON.parse(new TextDecoder().decode(merged));
	} catch {
		throw new RequestBodyError('Corpo da requisição não é um JSON válido.');
	}
}
