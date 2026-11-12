import { describe, expect, it } from 'vitest';
import { summarizeArchive } from './summary';
import type { ArchiveEntry } from '../types';

const entry = (id: string, status: ArchiveEntry['status'], bytes: number): ArchiveEntry => ({
	id,
	status,
	title: id,
	url: `https://e.com/${id}`,
	bytes,
	assets: 0,
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z'
});

describe('summarizeArchive', () => {
	it('resume o arquivo por status', () => {
		const summary = summarizeArchive([
			entry('a', 'ready', 10),
			entry('b', 'pending', 0),
			entry('c', 'failed', 0)
		]);

		expect(summary).toEqual({ count: 3, bytes: 10, pending: 1, failed: 1 });
	});
});
