import { appendFileSync, mkdirSync } from 'node:fs';
import { connect } from 'node:net';
import { join } from 'node:path';

/**
 * @param {string} message
 * @param {string} [dataDir]
 * @returns {string}
 */
export function logStartup(message, dataDir = process.env.HUB_DATA_DIR ?? 'data') {
	const line = `[${new Date().toISOString()}] ${message}\n`;
	try {
		mkdirSync(dataDir, { recursive: true });
		appendFileSync(join(dataDir, 'autostart.log'), line);
	} catch {
		// Sem log não pode impedir o start manual.
	}
	return line;
}

/**
 * @param {string} host
 * @param {number} port
 * @param {number} [timeoutMs]
 * @returns {Promise<boolean>}
 */
export function checkPort(host, port, timeoutMs = 500) {
	return new Promise((resolve) => {
		const socket = connect({ host, port });
		let settled = false;

		/** @param {boolean} value */
		const done = (value) => {
			if (settled) return;
			settled = true;
			socket.destroy();
			resolve(value);
		};

		socket.once('connect', () => done(true));
		socket.once('error', () => done(false));
		socket.setTimeout(timeoutMs, () => done(false));
	});
}
