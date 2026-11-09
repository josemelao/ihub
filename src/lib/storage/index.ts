import type { HubStorage } from '../types';
import { JsonFileStorage } from './json-file';

let instance: JsonFileStorage | null = null;

export function getStorage(): JsonFileStorage {
	if (!instance) {
		instance = new JsonFileStorage(process.env.HUB_DATA_DIR ?? 'data');
	}
	return instance;
}

export type { HubStorage };
