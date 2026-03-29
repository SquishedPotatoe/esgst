import { DOM } from '../../class/DOM';
import { FetchRequest } from '../../class/FetchRequest';
import { Module } from '../../class/Module';
import { Settings } from '../../class/Settings';
import { common } from '../Common';
import { Session } from '../../class/Session';

class GamesHideInTableButton extends Module {
	constructor() {
		super();
		this.info = {
			id: 'hgitb',
			name: 'Hide Games In Tables Button',
			description: () => (
				<ul>
					<li>
						Adds a button in the table header to (Hide All <i className="fa fa-eye-slash"></i>)
						or (Unhide All <i className="fa fa-eye"></i>) games in that table.
					</li>
					<li>
						Adds a button (<i className="fa fa-eye"></i> if the game is hidden and{' '}
						<i className="fa fa-eye-slash"></i> if it is not) at the end of table rows
						with Steam app or package links to hide/unhide individual games. Unresolved
						games will be marked as <i className="fa fa-question"></i>.
					</li>
				</ul>
			),
			features: {
				hgitb_c: {
					name: `Use colored icons.`,
					description: () => (
						<ul>
							<li>
								Uses colored icons in table rows <i className="fa fa-eye-slash esgst-green"></i>
								<i className="fa fa-eye esgst-red"></i>
								<i className="fa fa-question esgst-yellow"></i>
							</li>
						</ul>
					),
					sg: true,
				},
			},
			sg: true,
			type: 'games',
			featureMap: {
				endless: this.hgitb_getTables.bind(this),
			},
		};
	}

	init() {
		if (!(this.esgst.commentsPath || Settings.get('hgitb'))) return;
		this.hgitb_getTables(document);
	}

	hgitb_getTables(context) {
		const tables = context.querySelectorAll('table');
		for (const table of tables) {
			if (!table.querySelector('tbody tr a[href*="/app/"], tbody tr a[href*="/sub/"]')) continue;
			initTable(table, this.esgst);
		}
	}
}

function applyColorState(button, state) {
	if (!Settings.get('hgitb_c')) return;
	button.classList.remove('esgst-red', 'esgst-green', 'esgst-yellow');
	if (state === 'hidden') button.classList.add('esgst-red');
	else if (state === 'visible') button.classList.add('esgst-green');
	else if (state === 'notfound') button.classList.add('esgst-yellow');
}

function initTable(table, esgst) {
	if (table.classList.contains('esgst-hgitb-initialized')) return;
	table.classList.add('esgst-hgitb-initialized');

	if (!esgst.games) esgst.games = {};
	if (!esgst.games.apps) esgst.games.apps = {};
	if (!esgst.games.subs) esgst.games.subs = {};

	const state = { table, esgst, giveaways: [], header: null, loading: false };
	const theadRow = table.querySelector('thead tr');
	if (!theadRow) return;

	const header = document.createElement('th');
	header.className = 'esgst-hgitb-col esgst-clickable';

	const text = document.createElement('span');
	const icon = document.createElement('i');
	icon.style.marginLeft = '5px';

	header.appendChild(text);
	header.appendChild(icon);

	header._textRef = text;
	header._iconRef = icon;

	theadRow.appendChild(header);
	state.header = header;

	state.giveaways = Array.from(table.querySelectorAll('tbody tr'))
		.map(tr => initRow(tr, state))
		.filter(Boolean);

	updateHeader(state);
	header.addEventListener('click', () => onHeaderClick(state));

	lookupUnknown(state);
}

function initRow(tr, state) {
	const link = tr.querySelector('a[href*="/app/"], a[href*="/sub/"]');
	if (!link) return null;

	const match = link.pathname.match(/^\/(app|sub)\/(\d+)/);
	if (!match) return null;

	const [, type, gameId] = match;
	const storageType = type === 'app' ? 'apps' : 'subs';

	const cell = document.createElement('td');
	cell.className = 'esgst-hgitb-cell';
	cell.style.textAlign = 'center';
	tr.appendChild(cell);

	const saved = state.esgst.games[storageType][gameId];

	let g;

	if (saved) {
		const hidden = !!saved.hidden;
		tr.classList.toggle('esgst-faded', hidden);

		g = { type, storageType, gameId, row: tr, cell, hidden, notFound: false, unknown: false };
		g.button = createRowButton(g, state);
		applyHiddenState(g, hidden);
	} else {
		g = { type, storageType, gameId, row: tr, cell, hidden: false, notFound: false, unknown: true };
		g.button = createRowButton(g, state);
		g.button.className = 'fa fa-circle-o-notch fa-spin esgst-hgitb';
	}

	return g;
}

async function lookupUnknown(state) {
	const unknown = state.giveaways.filter(g => g.unknown);
	if (!unknown.length) return;

	await runBurstBatches(unknown, 10, async (g) => {
		const result = await getLocalSgIdHint(state.esgst, g.storageType, g.gameId);

		if (result.sgId) {
			g.sgId = result.sgId;
			g.sgIdSource = result.source;
			g.hidden = false;
			g.unknown = false;
			applyHiddenState(g, false);
		} else {
			g.unknown = false;
			markUnknown(g);
		}
	});

	await applyServerSgIdHints(state, unknown);
	updateHeader(state);
}

function createRowButton(g, state) {
	const button = document.createElement('i');
	button.className = 'fa esgst-clickable esgst-hgitb';

	button.addEventListener('click', async () => {
		if (state.loading || g.notFound || g.unknown) return;

		state.loading = true;
		const hide = !g.hidden;

		const obj = {
			appIds: g.type === 'app' ? [g.gameId] : [],
			subIds: g.type === 'sub' ? [g.gameId] : [],
			canceled: false,
		};

		button.className = 'fa fa-circle-o-notch fa-spin esgst-hgitb';

		try {
			const result = await hiddenGames(state.esgst, obj, !hide);
			const nf = g.type === 'app' ? result.apps : result.subs;

			if (nf.includes(g.gameId)) markNotFound(g);
			else applyHiddenState(g, hide);
		} finally {
			state.loading = false;
			updateHeader(state);
		}
	});

	g.cell.appendChild(button);
	return button;
}

async function onHeaderClick(state) {
	if (state.loading) return;

	const valid = state.giveaways.filter(g => !g.notFound && !g.unknown);
	if (!valid.length) return;

	state.loading = true;

	const allHidden = valid.length > 0 && valid.every(g => g.hidden);
	const hideAll = !allHidden;

	const obj = { appIds: [], subIds: [], canceled: false };
	valid.forEach(g => (g.type === 'app' ? obj.appIds : obj.subIds).push(g.gameId));

	state.header._iconRef.className = 'fa fa-circle-o-notch fa-spin';

	try {
		const result = await hiddenGames(state.esgst, obj, !hideAll);

		valid.forEach(g => {
			const nf = g.type === 'app' ? result.apps : result.subs;
			if (nf.includes(g.gameId)) markNotFound(g);
			else applyHiddenState(g, hideAll);
		});
	} finally {
		state.loading = false;
		updateHeader(state);
	}
}

function updateHeader(state) {
	const valid = state.giveaways.filter(g => !g.notFound && !g.unknown);
	const allHidden = valid.length > 0 && valid.every(g => g.hidden);

	state.header._textRef.textContent = allHidden ? 'Unhide All' : 'Hide All';
	state.header._iconRef.className = 'fa ' + (allHidden ? 'fa-eye' : 'fa-eye-slash');
	state.header.title = allHidden ? 'Unhide all games' : 'Hide all games';
}

function applyHiddenState(g, hidden) {
	g.hidden = hidden;
	g.row.classList.toggle('esgst-faded', hidden);

	const b = g.button;
	b.className = 'fa esgst-clickable esgst-hgitb';
	b.classList.add(hidden ? 'fa-eye' : 'fa-eye-slash');
	b.title = hidden ? 'Unhide this game' : 'Hide this game';
	applyColorState(b, hidden ? 'hidden' : 'visible');
}

function markNotFound(g) {
	g.notFound = true;
	const b = g.button;
	b.className = 'fa esgst-clickable esgst-hgitb fa-question';
	b.title = 'Game not found';
	applyColorState(b, 'notfound');
}

function markUnknown(g) {
	g.notFound = false;
	const b = g.button;
	b.className = 'fa esgst-clickable esgst-hgitb fa-question';
	b.title = 'Game not yet resolved';
	applyColorState(b, 'notfound');
}

async function runBatched(items, limit, worker) {
	let index = 0;

	async function next() {
		while (index < items.length) {
			const current = index++;
			await worker(items[current]);
		}
	}

	await Promise.all(
		Array(Math.min(limit, items.length))
			.fill(null)
			.map(next)
	);
}

const exactSgIdCache = new Map();
const verifiedSgIdCache = new Map();

function getSgIdKey(type, id) {
	return `${type}:${id}`;
}

async function getServerSgIdCache() {
	const raw = common.getValue('sgdbCache', null);
	let api = null;

	if (raw) {
		try {
			api = JSON.parse(raw);
		} catch (err) {}
	}

	if (!api?.lastUpdate || Date.now() - api.lastUpdate > 7 * 24 * 60 * 60 * 1000) {
		api = await common.SgdbCache();
	}

	return {
		apps: api?.cache?.appids || {},
		subs: api?.cache?.subids || {},
	};
}

async function applyServerSgIdHints(state, rows) {
	const unresolved = rows.filter((g) => g && !g.sgId);
	if (!unresolved.length) return;

	const serverCache = await getServerSgIdCache();
	await runBurstBatches(unresolved, 10, async (g) => {
		const serverSgId = serverCache?.[g.storageType]?.[g.gameId] ?? null;
		if (!serverSgId) return;

		g.sgId = serverSgId;
		g.sgIdSource = 'server';
		g.unknown = false;
		g.hidden = false;
		applyHiddenState(g, false);
	});
}

async function getExactSgId(esgst, id, type) {
	const key = getSgIdKey(type, id);
	if (exactSgIdCache.has(key)) {
		return exactSgIdCache.get(key);
	}

	const response = await FetchRequest.post('/ajax.php', {
		data: `do=autocomplete_giveaway_game&page_number=1&search_query=${encodeURIComponent(id)}`,
		doNotQueue: true,
	});

	const elements = DOM.parse(response.json.html).querySelectorAll('.table__row-outer-wrap');
	for (const element of elements) {
		const info = await esgst.modules.games.games_getInfo(element);
		if (info && info.type === type && info.id === id) {
			const result = element.getAttribute('data-autocomplete-id') || null;
			exactSgIdCache.set(key, result);
			return result;
		}
	}

	exactSgIdCache.set(key, null);
	return null;
}

async function getLocalSgIdHint(esgst, storageType, id) {
	const saved = esgst.games?.[storageType]?.[id];
	if (saved?.sgId) {
		return { sgId: saved.sgId, saveSgId: false, source: 'local' };
	}
	return { sgId: null, saveSgId: false, source: 'miss' };
}

async function verifySgId(esgst, storageType, id) {
	const key = getSgIdKey(storageType, id);
	if (verifiedSgIdCache.has(key)) {
		return { sgId: verifiedSgIdCache.get(key), saveSgId: false, source: 'verified-cache' };
	}

	const serverCache = await getServerSgIdCache();
	const serverSgId = serverCache?.[storageType]?.[id] ?? null;
	const liveSgId = await getExactSgId(esgst, id, storageType);

	if (!liveSgId) {
		return { sgId: null, saveSgId: false, serverSgId, source: 'miss' };
	}

	verifiedSgIdCache.set(key, liveSgId);

	return {
		sgId: liveSgId,
		saveSgId: !serverSgId || String(serverSgId) !== String(liveSgId),
		serverSgId,
		source: !serverSgId
			? 'live'
			: String(serverSgId) === String(liveSgId)
				? 'server'
				: 'live-corrected',
	};
}

async function runBurstBatches(items, batchSize, worker) {
	const results = [];

	for (let i = 0; i < items.length; i += batchSize) {
		const batch = items.slice(i, i + batchSize);

		const batchResults = await Promise.all(
			batch.map(item => worker(item))
		);

		results.push(...batchResults);
	}

	return results;
}

async function hiddenGames(esgst, obj, unhide) {
	const ids = new Set();
	const notFound = { apps: [], subs: [] };
	const action = unhide ? 'remove_filter' : 'hide_giveaways_by_game_id';
	const toFetch = [];

	for (const gameId of obj.appIds || []) {
		const saved = esgst.games.apps[gameId];
		let sgId = saved?.sgId || verifiedSgIdCache.get(getSgIdKey('apps', gameId));

		if (!sgId) {
			toFetch.push({ type: 'apps', gameId });
			continue;
		}

		ids.add(sgId);
		if (!saved) {
			esgst.games.apps[gameId] = { hidden: unhide ? null : true };
		}
		esgst.games.apps[gameId].hidden = unhide ? null : true;
	}

	for (const gameId of obj.subIds || []) {
		const saved = esgst.games.subs[gameId];
		let sgId = saved?.sgId || verifiedSgIdCache.get(getSgIdKey('subs', gameId));

		if (!sgId) {
			toFetch.push({ type: 'subs', gameId });
			continue;
		}

		ids.add(sgId);
		if (!saved) {
			esgst.games.subs[gameId] = { hidden: unhide ? null : true };
		}
		esgst.games.subs[gameId].hidden = unhide ? null : true;
	}

	await runBurstBatches(toFetch, 10, async ({ type, gameId }) => {
		const result = await verifySgId(esgst, type, gameId);
		if (!result.sgId) {
			notFound[type].push(gameId);
			return;
		}

		ids.add(result.sgId);
		const games = esgst.games[type];
		if (!games[gameId]) {
			games[gameId] = { hidden: unhide ? null : true };
		}
		if (result.saveSgId && !games[gameId].sgId) {
			games[gameId].sgId = result.sgId;
		}
		games[gameId].hidden = unhide ? null : true;
	});

	const idArray = [...ids];

	await runBatched(idArray, 10, async (id) => {
		await FetchRequest.post('/ajax.php', {
			data: `xsrf_token=${Session.xsrfToken}&do=${action}&game_id=${id}`, doNotQueue: true
		});
	});

	await common.lockAndSaveGames({
		apps: esgst.games.apps,
		subs: esgst.games.subs,
	});

	return notFound;
}

const gamesHideInTableButton =
	new GamesHideInTableButton();

export { gamesHideInTableButton };
