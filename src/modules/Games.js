import { FetchRequest } from '../class/FetchRequest';
import { Module } from '../class/Module';
import { Scope } from '../class/Scope';
import { Settings } from '../class/Settings';
import { Shared } from '../class/Shared';
import { common } from './Common';

const getValue = common.getValue.bind(common),
	lockAndSaveGames = common.lockAndSaveGames.bind(common);
const WHITELIST = {
	25657: { id: 3970, type: 'apps' }, // Prey (2006)
};

class Games extends Module {
	constructor() {
		super();
		this.info = {
			endless: true,
			id: 'games',
			featureMap: {
				endless: this.games_load.bind(this),
			},
		};
	}

	async games_load(context, main, source, endless) {
		let games = await this.games_get(
			context,
			main,
			endless ? this.esgst.games : JSON.parse(getValue('games')),
			endless
		);
		if (!Object.keys(games.apps).length && !Object.keys(games.subs).length) return;
		const gamesToAdd = [];
		['apps', 'subs'].forEach((type) => {
			for (let id in games[type]) {
				if (games[type].hasOwnProperty(id)) {
					games[type][id].forEach((game) => {
						gamesToAdd.push({
							game,
							code: id,
							innerWrap: game.headingName,
							name: game.name,
							outerWrap: game.headingName,
							type: type,
						});
					});
				}
			}
		});
		Scope.addData('current', 'games', gamesToAdd, endless);
		for (const feature of this.esgst.gameFeatures) {
			await feature(games, main, source, endless, 'apps');
		}
		for (const id in games.apps) {
			if (games.apps.hasOwnProperty(id)) {
				games.apps[id].forEach((game) => this.esgst.modules.giveaways.giveaways_reorder(game));
			}
		}
		for (const id in games.subs) {
			if (games.subs.hasOwnProperty(id)) {
				games.subs[id].forEach((game) => this.esgst.modules.giveaways.giveaways_reorder(game));
			}
		}
		if (
			main &&
			this.esgst.gmf &&
			this.esgst.gmf.filteredCount &&
			Settings.get(`gmf_enable${this.esgst.gmf.type}`)
		) {
			this.esgst.modules.gamesGameFilters.filters_filter(this.esgst.gmf, false, endless);
		}
	}

	async games_get(context, main, savedGames, endless) {
		const games = { apps: {}, subs: {}, all: [] };
		const esPrefix = endless ? `.esgst-es-page-${endless}` : '';
		const prefixWrap = (selector) =>
			endless ? `${esPrefix} ${selector}, ${esPrefix}${selector}` : selector;

		const baseSelectors = [
			prefixWrap('.featured__outer-wrap--giveaway'),
			prefixWrap('.giveaway__row-outer-wrap'),
			prefixWrap('.table__row-outer-wrap'),
		];

		if (this.esgst.discussionPath && main) {
			baseSelectors.push(prefixWrap('.markdown table td'));
		}

		const matchesQuery = baseSelectors.join(', ');
		const headingNameQuery = (this.esgst.discussionPath && main)
			? `.giveaway__heading__name, .featured__heading__medium, .table__column__heading, a`
			: `.giveaway__heading__name, .featured__heading__medium, .table__column__heading`;

		const matches = context.querySelectorAll(matchesQuery);
		for (const match of matches) {
			let game = Scope.findData('main', 'giveaways').find((x) => x.outerWrap === match);

			if (!game) {
				game = { isGame: true, outerWrap: match };
			}

			game.container = game.outerWrap;
			game.columns = game.container.querySelector('.giveaway__columns, .featured__columns');
			game.table = Boolean(game.container.closest('table'));
			game.grid = game.container.closest('.esgst-gv-view');

			if (game.grid) {
				game.gvIcons = game.container.querySelector('.esgst-gv-icons');
			}

			game.panel = game.container.querySelector('.esgst-giveaway-panel');

			let info = await this.games_getInfo(game.container, main);
			game.headingName = game.container.querySelector(headingNameQuery);

			if (!game.headingName) continue;

			const href = game.headingName.getAttribute('href');
			if (href?.match(/\/(discussion|\/support\/ticket|trade)\//)) {
				continue;
			}

			game.heading = (game.table || this.esgst.wishlistPath)
				? game.headingName
				: game.headingName.parentElement;

			game.name ??= game.headingName.textContent;

			const steamGiftCard = game.name.match(/^\$(.+?)\sSteam\sGift\sCard$/);
			if (steamGiftCard) {
				game.points = parseInt(steamGiftCard[1].replace(/,/g, ''), 10);
				info = { id: `SteamGiftCard${game.points}`, type: 'apps' };
			}

			const humbleBundle = game.name.match(/^Humble.+?Bundle/);
			if (humbleBundle) {
				info = { id: game.name.replace(/\s/g, ''), type: 'apps' };
			}

			if (!info) continue;

			const { id, type } = info;
			game.id = id;
			game.type = type;

			const targetGame = Shared.esgst.games?.[game.type]?.[game.id];
			if (targetGame) {
				const keys = [
					'owned', 'wishlisted', 'previouslyWishlisted', 'followed',
					'hidden', 'ignored', 'previouslyEntered', 'previouslyWon',
					'reducedCV', 'noCV', 'banned', 'removed'
				];

				const parsedId = parseInt(game.id, 10);
				const { delistedGames } = Shared.esgst;

				for (const key of keys) {
					if (key === 'banned' && delistedGames.banned.includes(parsedId)) {
						game[key] = true;
					} else if (
						key === 'removed' &&
						(delistedGames.removed.includes(parsedId) || targetGame.removed)
					) {
						game[key] = true;
					} else {
						const targetKey = key === 'previouslyEntered' ? 'entered'
							: key === 'previouslyWon' ? 'won'
								: key;
						if (targetGame[targetKey]) {
							game[key] = true;
						}
					}
				}
			}

			if (
				Settings.get('lastSyncHiddenGames') > 0 &&
				window.location.pathname.match(/^\/account\/settings\/giveaways\/filters/) &&
				main
			) {
				const removeButton = game.container.querySelector('.table__remove-default');
				removeButton?.addEventListener(
					'click',
					common.updateHiddenGames.bind(common, id, type, true)
				);
			}

			games[type][id] ??= [];

			game.tagContext = (game.container.closest('.poll') && game.container.querySelector('.table__column__heading'))
				|| game.headingName;
			game.tagPosition = 'afterend';
			game.saved = this.esgst.games[type]?.[id];

			games[type][id].push(game);
			games.all.push(game);
		}

		return games;
	}

	async games_getInfo(context, main) {
		let id, type;
		if (!context) {
			return null;
		}
		const link = context.querySelector(
			`[href*="store.steampowered.com/app/"], [href*="store.steampowered.com/sub/"], [href*="store.steampowered.com/bundle/"], [href*="steamcommunity.com/app/"], [href*="steamcommunity.com/sub/"], [href*="steamcommunity.com/bundle/"], [href*="s.team/a/"]`
		);
		if (!link && Settings.get('gc_row')) {
			const fanatical = context.querySelector(`[href*="fanatical.com/"]`);
			if (fanatical) {
				const row = context.closest('tr');
				if (row) {
					row.style.backgroundColor = Settings.get('gc_row_bgColor');
					row.title = 'ESGST cannot check this game';
				}
			}
		}
		const image = context.querySelector(
			`[style*="/apps/"], [style*="/subs/"], [style*="/bundles/"]`
		);
		if (link || image) {
			const url = (link && link.getAttribute('href')) || (image && image.getAttribute('style'));
			if (!url) {
				return null;
			}
			const info = url.match(/\/(app|sub|bundle)s?\/(\d+)/) || url.match(/s\.team\/a\/(\d+)/);

			if (!info) {
				return null;
			}
			id = url.includes('s.team/a/') ? info[1] : info[2];
			type = url.includes('s.team/a/') ? 'apps' : `${info[1]}s`;
			return { id, type: type === 'bundles' ? 'subs' : type };
		}
		const gameId = context.getAttribute('data-game-id');
		if (gameId && WHITELIST[gameId]) {
			return WHITELIST[gameId];
		}
		const missing = context.querySelector('.table_image_thumbnail_missing');
		if (!missing) {
			return null;
		}
		const heading = context.querySelector('.table__column__heading');
		if (!heading) {
			return null;
		}
		const name = heading.textContent.trim();
		for (const type of ['apps', 'subs']) {
			for (const id in this.esgst.games[type]) {
				if (!this.esgst.games[type].hasOwnProperty(id)) {
					continue;
				}
				if (this.esgst.games[type][id].name === name) {
					return { id, type };
				}
			}
		}
		if (!heading.getAttribute('href')) {
			return null;
		}
		const response = await FetchRequest.get(heading.getAttribute('href'));
		const giveaway = (
			await this.esgst.modules.giveaways.giveaways_get(response.html, false, response.url)
		)[0];
		if (!giveaway || !giveaway.gameType || !giveaway.gameSteamId) {
			return null;
		}
		const games = {
			apps: {},
			subs: {},
		};
		games[giveaway.gameType][giveaway.gameSteamId] = { name };
		Scope.findData('main', 'giveaways').map((x) => {
			if (x.name !== name || x.id) {
				return x;
			}
			x.id = giveaway.gameSteamId;
			x.type = giveaway.gameType;
			if (this.esgst.games && this.esgst.games[x.type][x.id]) {
				const keys = [
					'owned',
					'wishlisted',
					'previouslyWishlisted',
					'followed',
					'hidden',
					'ignored',
					'previouslyEntered',
					'previouslyWon',
					'reducedCV',
					'noCV',
					'banned',
					'removed',
				];
				for (const key of keys) {
					if (key === 'banned' && Shared.esgst.delistedGames.banned.indexOf(parseInt(x.id)) > -1) {
						x[key] = true;
					} else if (
						key === 'removed' &&
						(Shared.esgst.delistedGames.removed.indexOf(parseInt(x.id)) > -1 ||
							Shared.esgst.games[x.type][x.id].removed)
					) {
						x[key] = true;
					} else if (
						Shared.esgst.games[x.type][x.id][
							key === 'previouslyEntered' ? 'entered' : key === 'previouslyWon' ? 'won' : key
						]
					) {
						x[key] = true;
					}
				}
			}
			return x;
		});
		if (
			main &&
			Shared.esgst.gf &&
			this.esgst.gf.filteredCount &&
			Settings.get(`gf_enable${this.esgst.gf.type}`)
		) {
			this.esgst.modules.giveawaysGiveawayFilters.filters_filter(this.esgst.gf);
		}
		lockAndSaveGames(games);
		return {
			id: giveaway.gameSteamId,
			type: giveaway.gameType,
		};
	}
}

const gamesModule = new Games();

export { gamesModule };
