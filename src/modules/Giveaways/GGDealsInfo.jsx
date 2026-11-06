import { DOM } from '../../class/DOM';
import { FetchRequest } from '../../class/FetchRequest';
import { Lock } from '../../class/Lock';
import { Module } from '../../class/Module';
import { permissions } from '../../class/Permissions';
import { Settings } from '../../class/Settings';
import { common } from '../Common';

const createElements = common.createElements.bind(common),
	getValue = common.getValue.bind(common),
	setValue = common.setValue.bind(common);
const regions = [
	['au', 'Australia'],
	['be', 'Belgium'],
	['br', 'Brazil'],
	['ca', 'Canada'],
	['ch', 'Switzerland'],
	['de', 'Germany'],
	['dk', 'Denmark'],
	['es', 'Spain'],
	['eu', 'Europe'],
	['fi', 'Finland'],
	['fr', 'France'],
	['gb', 'United Kingdom'],
	['ie', 'Ireland'],
	['it', 'Italy'],
	['nl', 'Netherlands'],
	['no', 'Norway'],
	['pl', 'Poland'],
	['se', 'Sweden'],
	['us', 'United States'],
];
class GiveawaysGGDealsInfo extends Module {
	constructor() {
		super();
		this.info = {
			description: () => (
				<ul>
					<li>
						Adds to the sidebar of any{' '}
						<a href="https://www.steamgifts.com/giveaway/aeqw7/">giveaway</a> or{' '}
						<a href="https://www.steamgifts.com/game/4qdt1/dead-space-2008">game</a> page that shows the
						current and historical lowest prices for the game. This information is retrieved from{' '}
						<a href="https://gg.deals">GG.deals</a>.
					</li>
					<li>
						Results are cached for 24 hours.
					</li>
					<li>
						 A GG.deals API key is required, <a href="https://gg.deals/api/">Get a key</a>.
					</li>
				</ul>
			),
			id: 'ggdi',
			options: [
				{
					title: 'Show keyshop prices:',
					values: ['Disabled', 'Enabled'],
				},
				{
					title: 'Price region:',
					values: regions.map(([code, name]) => `${name} (${code.toUpperCase()})`),
				},
			],
			inputItems: [
				{
					id: 'ggDealsApiKey',
					prefix: 'API Key: ',
				},
			],
			name: 'GG.deals Info',
			sg: true,
			type: 'giveaways',
		};
	}

	async init() {
		if (
			!(this.esgst.giveawayPath || this.esgst.gamePath) ||
			!Settings.get('ggdi_sg') ||
			!Settings.get('ggDealsApiKey') ||
			!(await permissions.contains([['ggDeals']]))
		) {
			return;
		}

		this.esgst.giveawayFeatures.push(this.ggdi_getGiveaways.bind(this));
		if (this.esgst.gamePath) {
			this.esgst.gameFeatures.push(this.ggdi_getGames.bind(this));
		}
	}

	ggdi_getGames(games, main) {
		if (!this.esgst.gamePath || !main) return;
		const game = games.all?.find((item) => item.id && ['apps', 'subs'].includes(item.type));
		if (!game) {
			return;
		}
		this.ggdi_getInfo(Date.now(), game);
	}

	ggdi_getGiveaways(giveaways, main) {
		if (!this.esgst.giveawayPath || !main) {
			return;
		}
		const currentTime = Date.now();
		for (const giveaway of giveaways) {
			if (!giveaway?.id || !['apps', 'subs'].includes(giveaway.type)) {
				continue;
			}
			// noinspection JSIgnoredPromiseFromCall
			this.ggdi_getInfo(currentTime, giveaway);
		}
	}

	async ggdi_getInfo(currentTime, giveaway) {
		if (!giveaway?.id || !['apps', 'subs'].includes(giveaway.type)) {
			return;
		}

		const game = this.esgst.games?.[giveaway.type]?.[giveaway.id];
		const region = regions[Settings.get('ggdi_index_1') ?? 18][0];
		const gameType = giveaway.type.slice(0, -1);
		let prices = null;
		if (
			game &&
			game.ggDeals &&
			game.ggDeals.version === 3 &&
			game.ggDeals.gameType === gameType &&
			game.ggDeals.region === region &&
			currentTime - game.ggDeals.lastCheck < 86400000
		) {
			prices = game.ggDeals;
		} else {
			const sidebar = this.esgst.sidebar;
			if (!sidebar) {
				return;
			}
			const adotsHeading =
				Settings.get('adots') && Settings.get('adots_index') === 1
					? sidebar.querySelector('.esgst-adots-heading')
					: null;
			const loading = createElements(
				adotsHeading || sidebar,
				adotsHeading ? 'beforebegin' : 'beforeend',
				[
					{
						attributes: { class: 'sidebar__heading' },
						type: 'h3',
						children: [
							{ attributes: { class: 'fa fa-circle-o-notch fa-spin' }, type: 'i' },
							{ text: ' Loading GG.deals info...', type: 'node' },
						],
					},
				]
			);
			prices = await this.ggdi_loadInfo(giveaway, region, gameType);
			loading.remove();
		}
		this.ggdi_addInfo(prices);
	}

	async ggdi_loadInfo(giveaway, region, gameType) {
		const endpointTypes = {
			app: 'app',
			sub: 'sub',
		};
		const apiType = endpointTypes[gameType];
		const prices = {
			currentRetail: null,
			currentKeyshops: null,
			historicalRetail: null,
			historicalKeyshops: null,
			currency: null,
			lastCheck: Date.now(),
			gameType,
			region,
			url: `https://store.steampowered.com/${gameType}/${giveaway.id}/`,
			version: 3,
		};
		if (!apiType) {
			return prices;
		}
		try {
			const url = `https://api.gg.deals/v1/prices/by-steam-${apiType}-id/?ids=${encodeURIComponent(
				giveaway.id
			)}&key=${encodeURIComponent(Settings.get('ggDealsApiKey'))}&region=${encodeURIComponent(
				region
			)}`;
			const response = await FetchRequest.get(url, { queue: true });
			const result = response.json && response.json.data && response.json.data[giveaway.id];

			if (response.json?.success && result?.prices) {
				Object.assign(prices, result.prices);
				prices.url = result.url;
			}
		} catch (error) {
			console.error('[GG.deals Info] Price request failed.', error);
		}

		const lock = new Lock('game', { threshold: 300 });
		await lock.lock();
		const games = JSON.parse(getValue('games'));
		games[giveaway.type] ??= {};
		if (!games[giveaway.type][giveaway.id]) {
			games[giveaway.type][giveaway.id] = {};
		}
		games[giveaway.type][giveaway.id].ggDeals = prices;
		await setValue('games', JSON.stringify(games));
		await lock.unlock();
		return prices;
	}

	ggdi_sectionHeaderTemplate(text) {
		return {
			attributes: { class: 'sidebar__heading' },
			text,
			type: 'li',
		};
	}

	ggdi_itemTemplate(text1, text2, url) {
		return {
			attributes: { class: 'sidebar__navigation__item' },
			type: 'li',
			children: [
				{
					attributes: { class: 'sidebar__navigation__item__link', href: url },
					type: 'a',
					children: [
						{
							attributes: { class: 'sidebar__navigation__item__name' },
							text: text1,
							type: 'div',
						},
						{ attributes: { class: 'sidebar__navigation__item__underline' }, type: 'div' },
						{
							attributes: { class: 'sidebar__navigation__item__count' },
							text: text2,
							type: 'div',
						},
					],
				},
			],
		};
	}

	ggdi_noItemTemplate(text) {
		return {
			attributes: { class: 'sidebar__navigation__item' },
			text,
			type: 'li',
		};
	}

	ggdi_addInfo(prices) {
		const showKeyshops = Settings.get('ggdi_index_0') === 1;
		const navChildren = [];
		const items = [
			{
				attributes: { class: 'sidebar__heading esgst-ggdeals' },
				text: 'GG.Deals',
				type: 'h3',
			},
			{
				attributes: { class: 'sidebar__navigation esgst-ggdeals-prices' },
				type: 'ul',
				children: navChildren,
			},
		];
		const url = prices.url || 'https://gg.deals/';

		navChildren.push(this.ggdi_sectionHeaderTemplate('Current Prices'));
		if (prices.currentRetail) {
			navChildren.push(
				this.ggdi_itemTemplate(
					'Lowest Retail Price',
					`${prices.currentRetail} ${prices.currency || ''}`.trim(),
					url
				)
			);
		} else {
			navChildren.push(this.ggdi_noItemTemplate('There is no current retail price for this game.'));
		}
		if (showKeyshops) {
			if (prices.currentKeyshops) {
				navChildren.push(
					this.ggdi_itemTemplate(
						'Lowest Keyshop Price',
						`${prices.currentKeyshops} ${prices.currency || ''}`.trim(),
						url
					)
				);
			} else {
				navChildren.push(
					this.ggdi_noItemTemplate('There is no current keyshop price for this game.')
				);
			}
		}

		navChildren.push(this.ggdi_sectionHeaderTemplate('Historical Lowest Prices'));
		if (prices.historicalRetail) {
			navChildren.push(
				this.ggdi_itemTemplate(
					'Historical Lowest Retail Price',
					`${prices.historicalRetail} ${prices.currency || ''}`.trim(),
					url
				)
			);
		} else {
			navChildren.push(this.ggdi_noItemTemplate('There is no historical retail price for this game.'));
		}
		if (showKeyshops) {
			if (prices.historicalKeyshops) {
				navChildren.push(
					this.ggdi_itemTemplate(
						'Historical Lowest Keyshop Price',
						`${prices.historicalKeyshops} ${prices.currency || ''}`.trim(),
						url
					)
				);
			} else {
				navChildren.push(
					this.ggdi_noItemTemplate('There is no historical keyshop price for this game.')
				);
			}
		}

		const sidebar = this.esgst.sidebar;
		if (!sidebar) {
			return;
		}
		const adotsHeading =
			Settings.get('adots') && Settings.get('adots_index') === 1
				? sidebar.querySelector('.esgst-adots-heading')
				: null;
		createElements(
			adotsHeading || sidebar,
			adotsHeading ? 'beforebegin' : 'beforeend',
			items
		);
		const fanaticalContainer = document.querySelector('.sidebar .fanatical_container');
		if (fanaticalContainer) {
			sidebar.appendChild(fanaticalContainer.parentElement);
		}
	}
}

const giveawaysGGDealsInfo = new GiveawaysGGDealsInfo();

export { giveawaysGGDealsInfo };
