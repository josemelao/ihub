import { toSafeHttpUrl } from './net/url';

export interface QuickAddMetadata {
	name?: string;
	description?: string;
	icon?: string | null;
}

/**
 * Monta o deep link do Gerenciar que abre o editor de link já preenchido.
 * URLs inseguras caem no formulário vazio.
 */
export function buildQuickAddHref(
	baseUrl: string,
	url: string,
	metadata: QuickAddMetadata = {}
): string {
	const target = new URL('/gerenciar', baseUrl);
	target.searchParams.set('tab', 'itens');
	target.searchParams.set('add', 'link');

	const safeUrl = toSafeHttpUrl(url);
	if (!safeUrl) return target.toString();
	target.searchParams.set('url', safeUrl);

	if (metadata.name?.trim()) target.searchParams.set('name', metadata.name.trim());
	if (metadata.description?.trim()) {
		target.searchParams.set('description', metadata.description.trim());
	}
	const safeIcon = toSafeHttpUrl(metadata.icon);
	if (safeIcon) target.searchParams.set('icon', safeIcon);

	return target.toString();
}
