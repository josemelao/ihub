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

export function contrastText(hex: string): '#0b1020' | '#ffffff' {
	const { r, g, b } = hexToRgb(hex);
	const channel = (value: number): number => {
		const normalized = value / 255;
		return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
	};
	const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
	return luminance > 0.179 ? '#0b1020' : '#ffffff';
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
	return item.type === 'app' ? 'App do PC' : 'Link';
}

export function itemPlatform(item: HubItem): 'PC' | 'Link' {
	return item.type === 'app' ? 'PC' : 'Link';
}

/** Slugs do Simple Icons que ainda existem (fallback após o favicon oficial). */
const APP_ICON_SLUGS: Record<string, string> = {
	steam: 'steam',
	discord: 'discord',
	obsidian: 'obsidian',
	spotify: 'spotify',
	notion: 'notion',
	figma: 'figma',
	zoom: 'zoom',
	telegram: 'telegram',
	whatsapp: 'whatsapp'
};

/** Domínio oficial de cada protocolo: favicon colorido e atualizado. */
const APP_ICON_DOMAINS: Record<string, string> = {
	steam: 'store.steampowered.com',
	discord: 'discord.com',
	vscode: 'code.visualstudio.com',
	obsidian: 'obsidian.md',
	spotify: 'open.spotify.com',
	slack: 'slack.com',
	notion: 'notion.so',
	figma: 'figma.com',
	zoom: 'zoom.us',
	telegram: 'telegram.org',
	whatsapp: 'web.whatsapp.com',
	teams: 'teams.microsoft.com',
	'ms-word': 'word.cloud.microsoft',
	'ms-excel': 'excel.cloud.microsoft',
	'ms-powerpoint': 'powerpoint.cloud.microsoft',
	'ms-outlook': 'outlook.live.com'
};

function hostIconCandidates(host: string): string[] {
	const clean = host.trim().toLowerCase();
	if (!clean) return [];
	return [
		`https://icons.duckduckgo.com/ip3/${clean}.ico`,
		`https://www.google.com/s2/favicons?domain=${encodeURIComponent(clean)}&sz=64`,
		`https://${clean}/favicon.ico`
	];
}

/** Cadeia de favicons: DuckDuckGo → Google → favicon direto do site. */
export function faviconCandidates(url: string): string[] {
	try {
		const hostname = new URL(url).hostname;
		return hostname ? hostIconCandidates(hostname) : [];
	} catch {
		return [];
	}
}

/** Apps: favicon do domínio oficial e, se falhar, o ícone do Simple Icons. */
export function appIconCandidates(value: string): string[] {
	const scheme = value.split(':')[0]?.toLowerCase() ?? '';
	const domain = APP_ICON_DOMAINS[scheme];
	const slug = APP_ICON_SLUGS[scheme];
	const candidates = domain ? hostIconCandidates(domain) : [];
	if (slug) candidates.push(`https://cdn.simpleicons.org/${slug}`);
	return [...new Set(candidates)];
}

/** Lista ordenada de URLs de ícone; o componente tenta uma a uma. */
export function itemIconCandidates(item: HubItem): string[] {
	const defaults =
		item.type === 'link' ? faviconCandidates(item.url) : appIconCandidates(item.launch.value);
	const custom = item.icon?.trim();
	if (!custom) return defaults;
	const customUrl = /^https?:\/\//i.test(custom) ? custom : `https://cdn.simpleicons.org/${custom}`;
	return [customUrl, ...defaults.filter((url) => url !== customUrl)];
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
