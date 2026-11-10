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

export function categorySourceCounts(hub: HubData): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const source of hub.feedSources) {
		counts[source.categoryId] = (counts[source.categoryId] ?? 0) + 1;
	}
	return counts;
}

export function itemKind(item: HubItem): string {
	return item.type === 'app' ? 'App do PC' : 'Site';
}

export function itemPlatform(item: HubItem): 'PC' | 'Web' {
	return item.type === 'app' ? 'PC' : 'Web';
}

const APP_ICON_SLUGS: Record<string, string> = {
	steam: 'steam',
	discord: 'discord',
	vscode: 'visualstudiocode',
	obsidian: 'obsidian',
	spotify: 'spotify',
	slack: 'slack',
	notion: 'notion',
	figma: 'figma',
	zoom: 'zoom',
	telegram: 'telegram',
	whatsapp: 'whatsapp',
	'ms-word': 'microsoftword',
	'ms-excel': 'microsoftexcel',
	'ms-powerpoint': 'microsoftpowerpoint',
	'ms-outlook': 'microsoftoutlook'
};

export function faviconUrl(url: string): string | null {
	try {
		const hostname = new URL(url).hostname;
		if (!hostname) return null;
		return `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
	} catch {
		return null;
	}
}

export function appIconUrl(value: string, color = '#C9D2E3'): string | null {
	const scheme = value.split(':')[0]?.toLowerCase() ?? '';
	const slug = APP_ICON_SLUGS[scheme];
	if (!slug) return null;
	return `https://cdn.simpleicons.org/${slug}/${color.replace('#', '')}`;
}

export function itemIconUrl(item: HubItem, color = '#C9D2E3'): string | null {
	const custom = item.icon?.trim();
	if (custom) {
		return /^https?:\/\//i.test(custom)
			? custom
			: `https://cdn.simpleicons.org/${custom}/${color.replace('#', '')}`;
	}
	return item.type === 'link' ? faviconUrl(item.url) : appIconUrl(item.launch.value, color);
}

export function itemHref(item: HubItem): string {
	return item.type === 'app' ? item.launch.value : item.url;
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
