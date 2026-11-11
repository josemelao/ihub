import { getStorage } from '../storage';
import { createRefreshJobs } from './jobs';
import { refreshAndSave } from './scheduler';

/**
 * Instância única usada pelas rotas: o job só observa o refresh, que continua
 * passando pelo scheduler/runner (lock do cache e coalescência).
 */
export const refreshJobs = createRefreshJobs({
	count: async () => (await getStorage().loadHub()).feedSources.length,
	run: async (onSourceDone) => {
		await refreshAndSave(true, undefined, onSourceDone);
	}
});
