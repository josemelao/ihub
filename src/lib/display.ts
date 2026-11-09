import type { HubData, HubItem } from './types';

export function initials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return '?';
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
	const clean = hex.replace('#', '');
	const full =
		clean.length === 3
			? clean
					.split('')
					.map((c) => c + c)
					.join('')
			: clean;
	return {
		r: Number.parseInt(full.slice(0, 2), 16),
		g: Number.parseInt(full.slice(2, 4), 16),
		b: Number.parseInt(full.slice(4, 6), 16)
	};
}

export function tint(hex: string, alpha = 0.15): string {
	const { r, g, b } = hexToRgb(hex);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function categoryItemCounts(hub: HubData): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const item of hub.items) {
		counts[item.categoryId] = (counts[item.categoryId] ?? 0) + 1;
	}
	return counts;
}

export function itemKind(item: HubItem): string {
	return item.type === 'app' ? 'App do PC' : 'Site';
}

export function itemHref(item: HubItem): string {
	return item.type === 'app' ? item.launch.value : item.url;
}

export function itemTarget(item: HubItem): string | undefined {
	return item.type === 'link' && !item.url.startsWith('http') ? undefined : '_blank';
}

export function relativeTime(iso: string, now: number = Date.now()): string {
	if (!iso) return 'sem data';
	const timestamp = Date.parse(iso);
	if (Number.isNaN(timestamp)) return 'sem data';

	const diff = Math.max(0, now - timestamp);
	const minutes = Math.floor(diff / 60_000);
	if (minutes < 1) return 'agora';
	if (minutes < 60) return `há ${minutes} min`;

	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `há ${hours} h`;

	const days = Math.floor(hours / 24);
	if (days === 1) return 'ontem';
	if (days < 30) return `há ${days} dias`;

	return new Date(timestamp).toLocaleDateString('pt-BR');
}
