import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');

process.env.HOST ??= '127.0.0.1';
process.env.PORT ??= '5757';

await import('../build/index.js');
