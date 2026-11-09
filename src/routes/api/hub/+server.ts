import { json } from '@sveltejs/kit';
import {
	addApp,
	addCategory,
	addLink,
	addSavedFilter,
	addSource,
	moveCategory,
	moveItem,
	removeCategory,
	removeItem,
	removeSavedFilter,
	removeSource,
	toggleSource,
	updateItem,
	updateSource,
	updateCategory,
	type AppInput,
	type CategoryInput,
	type ItemPatch,
	type LinkInput,
	type SavedFilterInput,
	type SourceInput,
	type SourcePatch
} from '#lib/hub-edit';
import { HubValidationError, parseHub } from '#lib/schema';
import { getStorage } from '#lib/storage';
import type { RequestHandler } from './$types';

interface HubPayload {
	action?: string;
	id?: string;
	direction?: 'up' | 'down';
	item?: (LinkInput | AppInput) & { type?: 'link' | 'app' };
	patch?: ItemPatch;
	source?: SourceInput;
	sourcePatch?: SourcePatch;
	category?: CategoryInput;
	filter?: SavedFilterInput;
}

export const GET: RequestHandler = async () => {
	try {
		return json(await getStorage().loadHub());
	} catch (error) {
		if (error instanceof HubValidationError) {
			return json({ error: error.message, issues: error.issues }, { status: 500 });
		}
		throw error;
	}
};

export const POST: RequestHandler = async ({ request }) => {
	let payload: HubPayload;
	try {
		payload = (await request.json()) as HubPayload;
	} catch {
		return json({ ok: false, error: 'Corpo JSON inválido.' }, { status: 400 });
	}

	const storage = getStorage();

	try {
		const hub = await storage.loadHub();
		let next = hub;

		switch (payload.action) {
			case 'add-item': {
				if (!payload.item) return invalid('Informe o item.');
				next =
					payload.item.type === 'app'
						? addApp(hub, payload.item as AppInput)
						: addLink(hub, payload.item as LinkInput);
				break;
			}

			case 'update-item':
				if (!payload.id) return invalid('Informe o id do item.');
				next = updateItem(hub, payload.id, payload.patch ?? {});
				break;

			case 'delete-item':
				if (!payload.id) return invalid('Informe o id do item.');
				next = removeItem(hub, payload.id);
				break;

			case 'move-item':
				if (!payload.id || !payload.direction) return invalid('Informe id e direção.');
				next = moveItem(hub, payload.id, payload.direction);
				break;

			case 'add-source':
				if (!payload.source) return invalid('Informe a fonte.');
				next = addSource(hub, payload.source);
				break;

			case 'update-source':
				if (!payload.id) return invalid('Informe o id da fonte.');
				next = updateSource(hub, payload.id, payload.sourcePatch ?? {});
				break;

			case 'delete-source':
				if (!payload.id) return invalid('Informe o id da fonte.');
				next = removeSource(hub, payload.id);
				break;

			case 'toggle-source':
				if (!payload.id) return invalid('Informe o id da fonte.');
				next = toggleSource(hub, payload.id);
				break;

			case 'add-category':
				if (!payload.category) return invalid('Informe a categoria.');
				next = addCategory(hub, payload.category);
				break;

			case 'delete-category':
				if (!payload.id) return invalid('Informe o id da categoria.');
				next = removeCategory(hub, payload.id);
				break;

			case 'update-category':
				if (!payload.id) return invalid('Informe o id da categoria.');
				next = updateCategory(hub, payload.id, payload.category ?? {});
				break;

			case 'move-category':
				if (!payload.id || !payload.direction) return invalid('Informe id e direção.');
				next = moveCategory(hub, payload.id, payload.direction);
				break;

			case 'add-filter':
				if (!payload.filter) return invalid('Informe o filtro.');
				next = addSavedFilter(hub, payload.filter);
				break;

			case 'delete-filter':
				if (!payload.id) return invalid('Informe o id do filtro.');
				next = removeSavedFilter(hub, payload.id);
				break;

			default:
				return invalid('Ação inválida.');
		}

		const validated = parseHub(next);
		await storage.saveHub(validated);
		return json({ ok: true, hub: validated });
	} catch (error) {
		if (error instanceof HubValidationError) {
			return json({ ok: false, error: error.message, issues: error.issues }, { status: 400 });
		}
		if (error instanceof Error) {
			return json({ ok: false, error: error.message }, { status: 400 });
		}
		throw error;
	}
};

function invalid(message: string): Response {
	return json({ ok: false, error: message }, { status: 400 });
}
