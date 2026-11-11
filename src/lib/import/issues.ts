export interface ImportIssue {
	value: string;
	reason: string;
}

export const MAX_ISSUES = 20;

export function addIssue(issues: ImportIssue[], value: string, reason: string): void {
	if (issues.length >= MAX_ISSUES) return;
	issues.push({ value: value.slice(0, 200), reason });
}
