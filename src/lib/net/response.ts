export class HttpResponseError extends Error {
	readonly status: number;
	readonly body: string;

	constructor(status: number, message: string, body = '') {
		super(message);
		this.name = 'HttpResponseError';
		this.status = status;
		this.body = body;
	}
}

/**
 * Lê a resposta como JSON. Quando o servidor devolve texto/HTML (CSRF, proxy,
 * erro do adapter), lança um erro com status e trecho do corpo em vez de deixar
 * o `response.json()` estourar com "Unexpected token".
 */
export async function readJsonResponse<T>(response: Response): Promise<T> {
	const contentType = response.headers.get('content-type') ?? '';

	if (contentType.toLowerCase().includes('application/json')) {
		try {
			return (await response.json()) as T;
		} catch {
			throw new HttpResponseError(response.status, 'JSON inválido na resposta.');
		}
	}

	const text = (await response.text()).trim();
	if (!text) {
		throw new HttpResponseError(response.status, `HTTP ${response.status}: corpo vazio.`);
	}

	const preview = text.length > 200 ? `${text.slice(0, 200)}…` : text;
	throw new HttpResponseError(response.status, `HTTP ${response.status}: ${preview}`, text);
}
