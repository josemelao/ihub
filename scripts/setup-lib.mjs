import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * @param {string} source
 * @param {string} target
 * @returns {boolean}
 */
export function ensureFile(source, target) {
	if (existsSync(target)) return false;
	mkdirSync(dirname(target), { recursive: true });
	copyFileSync(source, target);
	return true;
}
