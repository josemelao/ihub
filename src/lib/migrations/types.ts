export interface MigrationResult<T> {
	data: T;
	from: number;
	to: number;
	notes: string[];
}

export interface Migration<T> {
	from: number;
	to: number;
	migrate(input: T): T;
	note: string;
}
