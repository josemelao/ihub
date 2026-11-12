const UNITS = ['B', 'KB', 'MB', 'GB'];

export function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';

	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < UNITS.length - 1) {
		value /= 1024;
		unit += 1;
	}

	if (unit === 0) return `${Math.round(value)} B`;
	return `${value.toFixed(1).replace('.', ',')} ${UNITS[unit]}`;
}
