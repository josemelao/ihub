import { z } from 'zod';
import type { HubData } from '../types';
import {
	applyBookmarksImport,
	applyOpmlImport,
	type FileImportResult,
	type FileImportSummary
} from './apply';
import { parseBookmarksHtml } from './bookmarks';
import type { ImportIssue } from './issues';
import { parseOpml } from './opml';

export type FileImportFormat = 'bookmarks' | 'opml';

export interface FileImportPreview {
	format: FileImportFormat;
	summary: FileImportSummary;
	samples: string[];
	invalid: ImportIssue[];
}

export const fileImportPayloadSchema = z.object({
	format: z.enum(['bookmarks', 'opml'], {
		message: "Formato inválido: use 'bookmarks' ou 'opml'."
	}),
	content: z.string().trim().min(1, 'O arquivo está vazio.'),
	categoryName: z.string().trim().min(1).max(80).optional()
});

export type FileImportPayload = z.infer<typeof fileImportPayloadSchema>;

function runFileImport(
	hub: HubData,
	format: FileImportFormat,
	content: string,
	categoryName?: string
): { result: FileImportResult; samples: string[]; invalid: ImportIssue[] } {
	if (format === 'bookmarks') {
		const parsed = parseBookmarksHtml(content);
		return {
			result: applyBookmarksImport(hub, parsed, { categoryName }),
			samples: parsed.bookmarks.slice(0, 8).map((bookmark) => bookmark.title),
			invalid: parsed.invalid ?? []
		};
	}

	const parsed = parseOpml(content);
	return {
		result: applyOpmlImport(hub, parsed, { categoryName }),
		samples: parsed.sources.slice(0, 8).map((source) => source.name),
		invalid: parsed.invalid ?? []
	};
}

export function applyFileImport(
	hub: HubData,
	format: FileImportFormat,
	content: string,
	categoryName?: string
): FileImportResult {
	return runFileImport(hub, format, content, categoryName).result;
}

export function previewFileImport(
	hub: HubData,
	format: FileImportFormat,
	content: string,
	categoryName?: string
): FileImportPreview {
	const { result, samples, invalid } = runFileImport(hub, format, content, categoryName);
	return { format, summary: result.summary, samples, invalid };
}
