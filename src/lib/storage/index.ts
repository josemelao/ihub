import type { HubStorage } from '../types';
import { JsonFileStorage } from './json-file';

let instance: HubStorage | null = null;

export function getStorage(): HubStorage {
	if (!instance) {
		instance = new JsonFileStorage(process.env.HUB_DATA_DIR ?? 'data');
	}
	return instance;
}

export type { HubStorage };
