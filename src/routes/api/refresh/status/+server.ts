import { json } from '@sveltejs/kit';
import { refreshJobs } from '#lib/feed/refresh-jobs';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	const id = url.searchParams.get('id');
	if (!id) {
		return json({ ok: false, error: 'Informe o id do job.' }, { status: 400 });
	}

	const job = refreshJobs.get(id);
	if (!job) {
		return json({ ok: false, error: 'Job não encontrado.' }, { status: 404 });
	}

	return json({ ok: true, job });
};
