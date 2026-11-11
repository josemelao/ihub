export function logStartup(message: string, dataDir?: string): string;
export function checkPort(host: string, port: number, timeoutMs?: number): Promise<boolean>;
