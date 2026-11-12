import { copyFile, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import type { AtomicFileDeps } from './atomic';

/** Dependências reais de I/O para escrita atômica (compartilhadas pelo storage). */
export const nodeFileDeps: AtomicFileDeps = {
	writeFile: (path, data) => writeFile(path, data, 'utf-8'),
	readFile: (path) => readFile(path, 'utf-8'),
	copyFile: (from, to) => copyFile(from, to),
	rename: (from, to) => rename(from, to),
	unlink: (path) => unlink(path),
	sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
	uniqueSuffix: () => `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
};
