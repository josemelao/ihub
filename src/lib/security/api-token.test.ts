import { describe, expect, it } from 'vitest';
import { isAuthorized, requiresApiToken } from './api-token';

describe('requiresApiToken', () => {
	it('protege mutações de /api', () => {
		expect(requiresApiToken('POST', '/api/hub')).toBe(true);
		expect(requiresApiToken('DELETE', '/api/notes')).toBe(true);
	});

	it('libera leituras e páginas', () => {
		expect(requiresApiToken('GET', '/api/hub')).toBe(false);
		expect(requiresApiToken('POST', '/gerenciar')).toBe(false);
	});
});

describe('isAuthorized', () => {
	it('sem token configurado libera tudo', () => {
		expect(isAuthorized(null, '')).toBe(true);
	});

	it('exige Bearer correto', () => {
		expect(isAuthorized('Bearer segredo', 'segredo')).toBe(true);
		expect(isAuthorized('bearer segredo', 'segredo')).toBe(true);
	});

	it('recusa ausência, valor errado e formato errado', () => {
		expect(isAuthorized(null, 'segredo')).toBe(false);
		expect(isAuthorized('Bearer outro', 'segredo')).toBe(false);
		expect(isAuthorized('segredo', 'segredo')).toBe(false);
		expect(isAuthorized('Bearer ', 'segredo')).toBe(false);
	});
});
