import { DOM } from '../../class/DOM';
import { FetchRequest } from '../../class/FetchRequest';
import { Logger } from '../../class/Logger';
import { Module } from '../../class/Module';
import { permissions } from '../../class/Permissions';
import { Popout } from '../../class/Popout';
import { Settings } from '../../class/Settings';
import { Shared } from '../../class/Shared';
import { ToggleSwitch } from '../../class/ToggleSwitch';
import { Button } from '../../components/Button';
import { NotificationBar } from '../../components/NotificationBar';
import { PageHeading } from '../../components/PageHeading';
import { Utils } from '../../lib/jsUtils';
import { common } from '../Common';

/**
 * @typedef {Object} GlwcObj
 * @property {NotificationBar} progressBar
 * @property {NotificationBar} overallProgressBar
 */

const createElements = common.createElements.bind(common),
	createHeadingButton = common.createHeadingButton.bind(common),
	createTooltip = common.createTooltip.bind(common);
class GroupsGroupLibraryWishlistChecker extends Module {
	constructor() {
		super();
		this.info = {
			description: () => (
				<ul>
					<li>
						Adds a button (<i className="fa fa-folder"></i> <i className="fa fa-star"></i> ) to your{' '}
						<a href="https://www.steamgifts.com/account/manage/whitelist">whitelist</a>/
						<a href="https://www.steamgifts.com/account/manage/blacklist">blacklist</a> pages and
						any <a href="https://www.steamgifts.com/group/SJ7Bu/">group</a> page that allows you to
						check how many of the whitelist/blacklist/group members have a certain game in their
						libraries/wishlists.
					</li>
					<li>
						The results are separated in 2 sections ("Libraries" and "Wishlists"). The games in each
						section are ranked based on the number of members that have them in their
						libraries/wishlists (each game also has a percentage that represents that number).
					</li>
					<li>
						Only the first 100 results are shown for each section, but you can use the search fields
						to find games that are outside of the top 100. If you are searching in the "Libraries"
						section, it is more accurate to search for games using their app id instead of their
						name, because the games in that section only have a name if they can also be found in
						the "Wishlists" section, as game names are not available in the libraries data and
						retrieving them would generate more requests to Steam, which is not good.
					</li>
					<li>
						If you hover over the number of libraries/wishlists for a game it shows the usernames of
						all of the members that have the game in their libraries/wishlists.
					</li>
					<li>
						A Steam API key is required to retrieve libraries data. If a key is not set in the last
						section of this menu, the feature will only retrieve wishlists data.
					</li>
				</ul>
			),
			id: 'glwc',
			name: 'Group Library/Wishlist Checker',
			sg: true,
			type: 'groups',
			features: {
				glwc_gn: {
					description: () => (
						<ul>
							<li>
								The new Steam wishlist page does not offer the game names in its source code, so
								ESGST cannot know the names of the games. However, by enabling this option, ESGST
								will fetch the list of all games on Steam, so that it can show you the names of the
								games properly. The only problem is that this list is huge, so it can slow down the
								feature execution a bit. This list is shared with Have / Want List Checker, if you
								also use that feature.
							</li>
						</ul>
					),
					name: 'Display game names.',
					sg: true,
				},
				glwc_mm: {
					dependencies: ['mm'],
					description: () => (
						<ul>
							<li>
								Allows checking a custom list of users provided by{' '}
								<span data-esgst-feature-id="mm"></span>.
							</li>
						</ul>
					),
					name: 'Integrate with [id=mm].',
					sg: true,
				},
			},
		};
	}

	async init() {
		if (Shared.esgst.whitelistPath || Shared.esgst.blacklistPath || Shared.esgst.groupPath) {
			let parameters;
			if (Shared.esgst.whitelistPath) {
				parameters = `url=account/manage/whitelist`;
			} else if (Shared.esgst.blacklistPath) {
				parameters = `url=account/manage/blacklist`;
			} else {
				parameters = `url=${
					window.location.pathname.match(/\/(group\/(.+?)\/(.+?))(\/.*)?$/)[1]
				}/users&id=${
					document.querySelector(`[href*="/gid/"]`).getAttribute('href').match(/\d+/)[0]
				}`;
			}
			createHeadingButton({
				id: 'glwc',
				icons: ['fa-folder', 'fa-star'],
				title: 'Check libraries/wishlists',
				link: `https://www.steamgifts.com/account/settings/profile?esgst=glwc&${parameters}`,
			});
		} else if (Shared.common.isCurrentPath('Account') && Shared.esgst.parameters.esgst === 'glwc') {
			if (!(await permissions.contains([['steamApi', 'steamCommunity', 'steamStore']]))) {
				return;
			}

			let glwc = {
				progressBar: NotificationBar.create().build().setLoading(),
				overallProgressBar: NotificationBar.create(),
			};
			let parameters;
			glwc.container = Shared.esgst.sidebar.nextElementSibling;
			if (Settings.get('removeSidebarInFeaturePages')) {
				Shared.esgst.sidebar.remove();
			}
			glwc.container.innerHTML = '';
			glwc.container.setAttribute('data-esgst-popup', true);
			const pageHeading = PageHeading.create('glwc', [
				{
					name: 'ESGST',
					url: Shared.esgst.settingsUrl,
				},
				{
					name: 'Group Library/Wishlist Checker',
					url: `https://www.steamgifts.com/account/settings/profile?esgst=glwc`,
				},
			]).insert(glwc.container, 'beforeend');
			const optionsButton = Button.create({
				color: 'alternate-white',
				tooltip: 'Options',
				icons: ['fa-gear'],
			}).insert(pageHeading.nodes.outer, 'beforeend');
			const popout = new Popout('', optionsButton.nodes.outer, 0, true);
			new ToggleSwitch(
				popout.popout,
				'glwc_checkMaxWishlists',
				false,
				(
					<fragment>
						Only check users with a maximum of{' '}
						<input
							className="esgst-switch-input"
							type="number"
							min="0"
							value={Settings.get('glwc_maxWishlists')}
							onchange={(event) => {
								Settings.set('glwc_maxWishlists', parseInt(event.target.value));
								Shared.common.setSetting('glwc_maxWishlists', Settings.get('glwc_maxWishlists'));
							}}
						/>{' '}
						games in their wishlist.
					</fragment>
				),
				false,
				false,
				'Enter the maximum number of games that a user must have in their wishlist in order to be checked.',
				Settings.get('glwc_checkMaxWishlists')
			);
			glwc.progressBar.insert(glwc.container, 'beforeend');
			glwc.overallProgressBar.insert(glwc.container, 'beforeend');
			glwc.context = createElements(glwc.container, 'beforeend', [
				{
					type: 'div',
				},
			]);
			parameters = Utils.getQueryParams();
			glwc.id = parameters.id;
			glwc.url = parameters.url;
			glwc.users = parameters.users
				? parameters.users.split(',').map((username) => ({ username }))
				: [];
			glwc.games = {};
			if (glwc.id) {
				glwc.overallProgressBar.setMessage('Preparing...');
				glwc.members = [];
				const members = (
					await FetchRequest.get(`http://steamcommunity.com/gid/${glwc.id}/memberslistxml?xml=1`)
				).text.match(/<steamID64>.+?<\/steamID64>/g);
				members.forEach((member) => {
					glwc.members.push(member.match(/<steamID64>(.+?)<\/steamID64>/)[1]);
				});
			}
			if (glwc.users.length > 0) {
				glwc.overallProgressBar.setMessage('Step 2 of 3');
				// noinspection JSIgnoredPromiseFromCall
				this.glwc_getSteamIds(glwc, 0, glwc.users.length);
			} else {
				glwc.overallProgressBar.setMessage('Step 1 of 3');
				// noinspection JSIgnoredPromiseFromCall
				this.glwc_getUsers(glwc, 1);
			}
		}
	}

	/**
	 * @param {GlwcObj} glwc
	 */
	async glwc_getUsers(glwc, nextPage) {
		if (glwc.isCanceled) return;
		glwc.progressBar.setMessage(`Retrieving users (page ${nextPage})...`);
		let elements, i, n, pagination, responseHtml;
		responseHtml = (await FetchRequest.get(`/${glwc.url}/search?page=${nextPage}`)).html;
		elements = responseHtml.querySelectorAll(`.table__row-inner-wrap:not(.is-faded)`);
		for (i = 0, n = elements.length; i < n; ++i) {
			glwc.users.push({
				username: elements[i].getElementsByClassName('table__column__heading')[0].textContent,
			});
		}
		pagination = responseHtml.getElementsByClassName('pagination__navigation')[0];
		if (pagination && !pagination.lastElementChild.classList.contains('is-selected')) {
			window.setTimeout(() => this.glwc_getUsers(glwc, ++nextPage), 0);
		} else {
			glwc.overallProgressBar.setMessage('Step 2 of 3');
			// noinspection JSIgnoredPromiseFromCall
			this.glwc_getSteamIds(glwc, 0, glwc.users.length);
		}
	}

	/**
	 * @param {GlwcObj} glwc
	 */
	async glwc_getSteamIds(glwc, i, n) {
		if (glwc.isCanceled) return;
		if (i < n) {
			glwc.progressBar.setMessage(`Retrieving Steam ids (${i + 1} of ${n})...`);
			let steamId = Shared.esgst.users.steamIds[glwc.users[i].username];
			if (steamId) {
				glwc.users[i].steamId = steamId;
				window.setTimeout(() => this.glwc_getSteamIds(glwc, ++i, n), 0);
			} else {
				const response = await FetchRequest.get(`/user/${glwc.users[i].username}?format=json`);
				if (response.json?.success) {
					glwc.users[i].steamId = response.json.user.steam_id;
				}
				window.setTimeout(() => this.glwc_getSteamIds(glwc, ++i, n), 0);
			}
		} else {
			glwc.overallProgressBar.setMessage(`Step 3 of 3 (this might take a while)`);
			glwc.memberCount = 0;
			// noinspection JSIgnoredPromiseFromCall

			if (Settings.get('glwc_gn')) {
				await Shared.esgst.modules.tradesHaveWantListChecker.hwlc_getGames(true);
			}

			this.glwc_getGames(glwc, 0, glwc.users.length);
		}
	}

	/**
	 * @param {GlwcObj} glwc
	 */
	async glwc_getGames(glwc, i, n) {
		if (glwc.isCanceled) return;
		if (i < n) {
			try {
				glwc.progressBar.setMessage(`Retrieving libraries/wishlists (${i + 1} of ${n})...`);
				if (!glwc.id || glwc.members.indexOf(glwc.users[i].steamId) >= 0) {
					try {
						glwc.users[i].failed = [];
						glwc.users[i].library = [];
						const elements = (
							await FetchRequest.get(
								`http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${Settings.get(
									'steamApiKey'
								)}&steamid=${glwc.users[i].steamId}&format=json`
							)
						).json.response.games;
						if (elements) {
							elements.forEach((element) => {
								let game = {
									id: element.appid,
									logo: `https://steamcdn-a.akamaihd.net/steam/apps/${element.appid}/header.jpg`,
									name: `${element.appid}`,
								};

								if (Shared.esgst.appList) {
									const name = Shared.esgst.appList[element.appid];

									if (name) {
										game.name = name;
									}
								}

								if (!glwc.games[game.id]) {
									game.libraries = [];
									game.wishlists = [];
									glwc.games[game.id] = game;
								}
								glwc.games[game.id].libraries.push(i);
								glwc.users[i].library.push(game.id);
							});
						}
					} catch (e) {
						/**/
					}
					glwc.users[i].wishlist = [];
					const wishlistData = (
						await FetchRequest.get(
							`https://api.steampowered.com/IWishlistService/GetWishlist/v1/?steamid=${glwc.users[i].steamId}&format=json`
						)
					).json.response.items;
					if (wishlistData) {
						const maxWishlists = Settings.get('glwc_checkMaxWishlists')
							? parseInt(Settings.get('glwc_maxWishlists'))
							: Infinity;
						if (wishlistData.length <= maxWishlists) {
							wishlistData.forEach((item) => {
								let id = item.appid;
								let game = { id };
								game.logo = `https://steamcdn-a.akamaihd.net/steam/apps/${id}/header.jpg`;

								if (Shared.esgst.appList) {
									const name = Shared.esgst.appList[item.appid];

									if (name) {
										game.name = name;
									}
								}

								if (!game.name) {
									game.name = `${id}`;
								}

								if (glwc.games[id]) {

									if (game.logo && game.name) {
										glwc.games[id].logo = game.logo;
										glwc.games[id].name = game.name;
									}
								} else {
									game.libraries = [];
									game.wishlists = [];
									glwc.games[id] = game;
								}
								glwc.games[id].wishlists.push(i);
								glwc.users[i].wishlist.push(parseInt(id));
							});
						}
					} else {
						glwc.users[i].failed.push(
							`<a class="table__column__secondary-link" href="https://steamcommunity.com/profiles/${glwc.users[i].steamId}">${glwc.users[i].username}</a>`
						);
					}
					glwc.memberCount += 1;
					window.setTimeout(() => this.glwc_getGames(glwc, ++i, n), 0);
				} else {
					window.setTimeout(() => this.glwc_getGames(glwc, ++i, n), 0);
				}
			} catch (err) {
				glwc.users[i].failed.push(
					`<a class="table__column__secondary-link" href="https://steamcommunity.com/profiles/${glwc.users[i].steamId}">${glwc.users[i].username}</a>`
				);
				window.setTimeout(() => this.glwc_getGames(glwc, ++i, n), 0);
			}
		} else {
			this.glwc_showResults(glwc);
		}
	}

	glwc_showResults(glwc) {
		const failedUsers = [...new Set(glwc.users.flatMap(user => user.failed.length > 0 ? user.failed : []))];
		if (failedUsers.length > 0) {
			glwc.progressBar.setWarning(`${failedUsers.length} users were not retrieved. Possibly games, wishlists or profile are private. (Hover to view details)`);
			const popout = createTooltip(
				glwc.container.querySelector('.notification--warning'),
				failedUsers.join(`, `),
				true
			);
			popout.onFirstOpen = () => Shared.common.endless_load(popout.popout);
		} else {
			glwc.progressBar.destroy();
		}
		glwc.overallProgressBar.destroy();

		let game,
			i,
			id,
			j,
			library,
			libraryInput,
			libraryResults,
			librarySearch,
			n,
			user,
			users,
			wishlist,
			wishlistInput,
			wishlistResults,
			wishlistSearch;
		glwc.context.classList.add('esgst-glwc-results');
		createElements(glwc.context, 'atinner', [
			{
				type: 'div',
				children: [
					{
						attributes: {
							class: 'esgst-glwc-heading',
						},
						text: 'Libraries',
						type: 'div',
					},
					{
						attribute: {
							placeholder: 'Search by game name or app id...',
							type: 'text',
						},
						type: 'input',
					},
					{
						attributes: {
							class: 'table',
						},
						type: 'div',
						children: [
							{
								attributes: {
									class: 'table__heading',
								},
								type: 'div',
								children: [
									{
										attributes: {
											class: 'table__column--width-small text-center',
										},
										text: 'Rank',
										type: 'div',
									},
									{
										attributes: {
											class: 'table__column--width-fill',
										},
										text: 'Game',
										type: 'div',
									},
									{
										attributes: {
											class: 'table__column--width-small text-center',
										},
										text: 'Libraries',
										type: 'div',
									},
								],
							},
							{
								attributes: {
									class: 'table__rows',
								},
								type: 'div',
							},
							{
								attributes: {
									class: 'table__rows',
								},
								type: 'div',
							},
						],
					},
				],
			},
			{
				type: 'div',
				children: [
					{
						attributes: {
							class: 'esgst-glwc-heading',
						},
						text: 'Wishlists',
						type: 'div',
					},
					{
						attribute: {
							placeholder: 'Search by game name or app id...',
							type: 'text',
						},
						type: 'input',
					},
					{
						attributes: {
							class: 'table',
						},
						type: 'div',
						children: [
							{
								attributes: {
									class: 'table__heading',
								},
								type: 'div',
								children: [
									{
										attributes: {
											class: 'table__column--width-small text-center',
										},
										text: 'Rank',
										type: 'div',
									},
									{
										attributes: {
											class: 'table__column--width-fill',
										},
										text: 'Game',
										type: 'div',
									},
									{
										attributes: {
											class: 'table__column--width-small text-center',
										},
										text: 'Wishlists',
										type: 'div',
									},
								],
							},
							{
								attributes: {
									class: 'table__rows',
								},
								type: 'div',
							},
							{
								attributes: {
									class: 'table__rows',
								},
								type: 'div',
							},
						],
					},
				],
			},
		]);
		libraryInput = glwc.context.firstElementChild.firstElementChild.nextElementSibling;
		libraryResults = libraryInput.nextElementSibling.lastElementChild;
		librarySearch = libraryResults.previousElementSibling;
		wishlistInput = glwc.context.lastElementChild.firstElementChild.nextElementSibling;
		wishlistResults = wishlistInput.nextElementSibling.lastElementChild;
		wishlistSearch = wishlistResults.previousElementSibling;
		library = [];
		wishlist = [];
		for (id in glwc.games) {
			if (glwc.games.hasOwnProperty(id)) {
				if (glwc.games[id].libraries.length) {
					library.push(glwc.games[id]);
				}
				if (glwc.games[id].wishlists.length) {
					wishlist.push(glwc.games[id]);
				}
			}
		}
		if (library.length > 0) {
			library = library.sort((a, b) => {
				if (a.libraries.length > b.libraries.length) {
					return -1;
				} else if (a.libraries.length < b.libraries.length) {
					return 1;
				} else {
					return 0;
				}
			});
			for (i = 0, n = library.length; i < 100 && i < n; ++i) {
				game = library[i];
				if (i <= 0 || game.libraries.length !== library[i - 1].libraries.length) {
					j = i + 1;
				}
				users = [];
				game.libraries.forEach((k) => {
					user = glwc.users[k];
					users.push(
						`<a class="table__column__secondary-link" href="http://steamcommunity.com/profiles/${user.steamId}/games?tab=all">${user.username}</a>`
					);
				});
				const popout = createTooltip(
					createElements(libraryResults, 'beforeend', [
						{
							attributes: {
								class: 'table__row-outer-wrap',
							},
							type: 'div',
							children: [
								{
									attributes: {
										class: 'table__row-inner-wrap',
									},
									type: 'div',
									children: [
										{
											attributes: {
												class: 'table__column--width-small text-center',
											},
											type: 'div',
											children: [
												{
													attributes: {
														class: 'table__column__rank',
													},
													text: `${j}.`,
													type: 'span',
												},
											],
										},
										{
											type: 'div',
											children: [
												{
													attributes: {
														class: 'table_image_thumbnail',
														style: `background-image:url(${game.logo});`,
													},
													type: 'div',
												},
											],
										},
										{
											attributes: {
												class: 'table__column--width-fill',
											},
											type: 'div',
											children: [
												{
													attributes: {
														class: 'table__column__heading',
													},
													text: game.name,
													type: 'p',
												},
												{
													type: 'p',
													children: [
														{
															attributes: {
																class: 'table__column__secondary-link',
																href: `http://store.steampowered.com/app/${game.id}`,
																rel: 'nofollow',
																target: '_blank',
															},
															text: `http://store.steampowered.com/app/${game.id}`,
															type: 'a',
														},
													],
												},
											],
										},
										{
											attributes: {
												class: 'table__column--width--small text-center',
											},
											type: 'div',
											children: [
												{
													attributes: {
														class: 'table__column__secondary-link esgst-clickable',
													},
													text: `${game.libraries.length} (${
														Math.round((game.libraries.length / glwc.memberCount) * 10000) / 100
													}%)`,
													type: 'span',
												},
											],
										},
									],
								},
							],
						},
					]).firstElementChild.lastElementChild.firstElementChild,
					users.join(`, `),
					true
				);
				popout.onFirstOpen = () => Shared.common.endless_load(popout.popout);
			}
		} else {
			createElements(libraryResults, 'atinner', [
				{
					text: 'To get libraries data you must have a Steam API key set in the settings menu.',
					type: 'node',
				},
			]);
		}
		wishlist = wishlist.sort((a, b) => {
			if (a.wishlists.length > b.wishlists.length) {
				return -1;
			} else if (a.wishlists.length < b.wishlists.length) {
				return 1;
			} else {
				return 0;
			}
		});
		for (i = 0, n = wishlist.length; i < 100 && i < n; ++i) {
			game = wishlist[i];
			if (i <= 0 || game.wishlists.length !== wishlist[i - 1].wishlists.length) {
				j = i + 1;
			}
			users = [];
			game.wishlists.forEach((k) => {
				user = glwc.users[k];
				users.push(
					`<a class="table__column__secondary-link" href="http://store.steampowered.com/wishlist/profiles/${user.steamId}">${user.username}</a>`
				);
			});
			const popout = createTooltip(
				createElements(wishlistResults, 'beforeend', [
					{
						attributes: {
							class: 'table__row-outer-wrap',
						},
						type: 'div',
						children: [
							{
								attributes: {
									class: 'table__row-inner-wrap',
								},
								type: 'div',
								children: [
									{
										attributes: {
											class: 'table__column--width-small text-center',
										},
										type: 'div',
										children: [
											{
												attributes: {
													class: 'table__column__rank',
												},
												text: `${j}.`,
												type: 'span',
											},
										],
									},
									{
										type: 'div',
										children: [
											{
												attributes: {
													class: 'table_image_thumbnail',
													style: `background-image:url(${game.logo});`,
												},
												type: 'div',
											},
										],
									},
									{
										attributes: {
											class: 'table__column--width-fill',
										},
										type: 'div',
										children: [
											{
												attributes: {
													class: 'table__column__heading',
												},
												text: game.name,
												type: 'p',
											},
											{
												type: 'p',
												children: [
													{
														attributes: {
															class: 'table__column__secondary-link',
															href: `http://store.steampowered.com/app/${game.id}`,
															rel: 'nofollow',
															target: '_blank',
														},
														text: `http://store.steampowered.com/app/${game.id}`,
														type: 'a',
													},
												],
											},
										],
									},
									{
										attributes: {
											class: 'table__column--width--small text-center',
										},
										type: 'div',
										children: [
											{
												attributes: {
													class: 'table__column__secondary-link esgst-clickable',
												},
												text: `${game.wishlists.length} (${
													Math.round((game.wishlists.length / glwc.memberCount) * 10000) / 100
												}%)`,
												type: 'span',
											},
										],
									},
								],
							},
						],
					},
				]).firstElementChild.lastElementChild.firstElementChild,
				users.join(`, `),
				true
			);
			popout.onFirstOpen = () => Shared.common.endless_load(popout.popout);
		}
		libraryInput.addEventListener('input', () => {
			const value = libraryInput.value.toLowerCase();
			if (value) {
				game = glwc.games[value];
				if (game) {
					if (game.libraries.length) {
						users = [];
						game.libraries.forEach((k) => {
							user = glwc.users[k];
							users.push(
								`<a class="table__column__secondary-link" href="http://steamcommunity.com/profiles/${user.steamId}/games?tab=all">${user.username}</a>`
							);
						});
						createElements(librarySearch, 'atinner', [
							{
								attributes: {
									class: 'table__row-outer-wrap',
								},
								type: 'div',
								children: [
									{
										attributes: {
											class: 'table__row-inner-wrap',
										},
										type: 'div',
										children: [
											{
												attributes: {
													class: 'table__column--width-small text-center',
												},
												type: 'div',
												children: [
													{
														attributes: {
															class: 'table__column__rank',
														},
														text: '-',
														type: 'span',
													},
												],
											},
											{
												type: 'div',
												children: [
													{
														attributes: {
															class: 'table_image_thumbnail',
															style: `background-image:url(${game.logo});`,
														},
														type: 'div',
													},
												],
											},
											{
												attributes: {
													class: 'table__column--width-fill',
												},
												type: 'div',
												children: [
													{
														attributes: {
															class: 'table__column__heading',
														},
														text: game.name,
														type: 'p',
													},
													{
														type: 'p',
														children: [
															{
																attributes: {
																	class: 'table__column__secondary-link',
																	href: `http://store.steampowered.com/app/${game.id}`,
																	rel: 'nofollow',
																	target: '_blank',
																},
																text: `http://store.steampowered.com/app/${game.id}`,
																type: 'a',
															},
														],
													},
												],
											},
											{
												attributes: {
													class: 'table__column--width-small text-center',
												},
												type: 'div',
												children: [
													{
														attributes: {
															class: 'table__column__secondary-link esgst-clickable',
														},
														text: `${game.libraries.length} (${
															Math.round((game.libraries.length / glwc.memberCount) * 10000) / 100
														}%)`,
														type: 'span',
													},
												],
											},
										],
									},
								],
							},
						]);
						const popout = createTooltip(
							librarySearch.firstElementChild.firstElementChild.lastElementChild.firstElementChild,
							users.join(`, `),
							true
						);
						popout.onFirstOpen = () => Shared.common.endless_load(popout.popout);
					} else {
						createElements(librarySearch, 'atinner', [
							{
								text: 'Nothing found...',
								type: 'node',
							},
						]);
					}
				} else {
					librarySearch.innerHTML = '';
					for (i = 0, j = 0, n = library.length; j < 100 && i < n; ++i) {
						game = library[i];
						if (game.name.toLowerCase().match(value)) {
							users = [];
							game.libraries.forEach((k) => {
								user = glwc.users[k];
								users.push(
									`<a class="table__column__secondary-link" href="http://steamcommunity.com/profiles/${user.steamId}/games?tab=all">${user.username}</a>`
								);
							});
							const popout = createTooltip(
								createElements(librarySearch, 'beforeend', [
									{
										attributes: {
											class: 'table__row-outer-wrap',
										},
										type: 'div',
										children: [
											{
												attributes: {
													class: 'table__row-inner-wrap',
												},
												type: 'div',
												children: [
													{
														attributes: {
															class: 'table__column--width-small text-center',
														},
														type: 'div',
														children: [
															{
																attributes: {
																	class: 'table__column__rank',
																},
																text: '-',
																type: 'span',
															},
														],
													},
													{
														type: 'div',
														children: [
															{
																attributes: {
																	class: 'table_image_thumbnail',
																	style: `background-image:url(${game.logo});`,
																},
																type: 'div',
															},
														],
													},
													{
														attributes: {
															class: 'table__column--width-fill',
														},
														type: 'div',
														children: [
															{
																attributes: {
																	class: 'table__column__heading',
																},
																text: game.name,
																type: 'p',
															},
															{
																type: 'p',
																children: [
																	{
																		attributes: {
																			class: 'table__column__secondary-link',
																			href: `http://store.steampowered.com/app/${game.id}`,
																			rel: 'nofollow',
																			target: '_blank',
																		},
																		text: `http://store.steampowered.com/app/${game.id}`,
																		type: 'a',
																	},
																],
															},
														],
													},
													{
														attributes: {
															class: 'table__column--width--small text-center',
														},
														type: 'div',
														children: [
															{
																attributes: {
																	class: 'table__column__secondary-link esgst-clickable',
																},
																text: `${game.libraries.length} (${
																	Math.round((game.libraries.length / glwc.memberCount) * 10000) /
																	100
																}%)`,
																type: 'span',
															},
														],
													},
												],
											},
										],
									},
								]).firstElementChild.lastElementChild.firstElementChild,
								users.join(`, `),
								true
							);
							popout.onFirstOpen = () => Shared.common.endless_load(popout.popout);
							j += 1;
						}
					}
					if (!librarySearch.innerHTML) {
						createElements(librarySearch, 'atinner', [
							{
								text: 'Nothing found...',
								type: 'node',
							},
						]);
					}
				}
				librarySearch.classList.remove('esgst-hidden');
				libraryResults.classList.add('esgst-hidden');
			} else {
				libraryResults.classList.remove('esgst-hidden');
				librarySearch.classList.add('esgst-hidden');
			}
		});
		wishlistInput.addEventListener('input', () => {
			const value = wishlistInput.value;
			if (value) {
				game = glwc.games[value];
				if (game) {
					if (game.wishlists.length) {
						users = [];
						game.wishlists.forEach((k) => {
							user = glwc.users[k];
							users.push(
								`<a class="table__column__secondary-link" href="http://store.steampowered.com/wishlist/profiles/${user.steamId}">${user.username}</a>`
							);
						});
						createElements(wishlistSearch, 'atinner', [
							{
								attributes: {
									class: 'table__row-outer-wrap',
								},
								type: 'div',
								children: [
									{
										attributes: {
											class: 'table__row-inner-wrap',
										},
										type: 'div',
										children: [
											{
												attributes: {
													class: 'table__column--width-small text-center',
												},
												type: 'div',
												children: [
													{
														attributes: {
															class: 'table__column__rank',
														},
														text: '-',
														type: 'span',
													},
												],
											},
											{
												type: 'div',
												children: [
													{
														attributes: {
															class: 'table_image_thumbnail',
															style: `background-image:url(${game.logo});`,
														},
														type: 'div',
													},
												],
											},
											{
												attributes: {
													class: 'table__column--width-fill',
												},
												type: 'div',
												children: [
													{
														attributes: {
															class: 'table__column__heading',
														},
														text: game.name,
														type: 'p',
													},
													{
														type: 'p',
														children: [
															{
																attributes: {
																	class: 'table__column__secondary-link',
																	href: `http://store.steampowered.com/app/${game.id}`,
																	rel: 'nofollow',
																	target: '_blank',
																},
																text: `http://store.steampowered.com/app/${game.id}`,
																type: 'a',
															},
														],
													},
												],
											},
											{
												attributes: {
													class: 'table__column--width-small text-center',
												},
												type: 'div',
												children: [
													{
														attributes: {
															class: 'table__column__secondary-link esgst-clickable',
														},
														text: `${game.wishlists.length} (${
															Math.round((game.wishlists.length / glwc.memberCount) * 10000) / 100
														}%)`,
														type: 'span',
													},
												],
											},
										],
									},
								],
							},
						]);
						const popout = createTooltip(
							wishlistSearch.firstElementChild.firstElementChild.lastElementChild.firstElementChild,
							users.join(`, `),
							true
						);
						popout.onFirstOpen = () => Shared.common.endless_load(popout.popout);
					} else {
						createElements(wishlistSearch, 'atinner', [
							{
								text: 'Nothing found...',
								type: 'node',
							},
						]);
					}
				} else {
					wishlistSearch.innerHTML = '';
					for (i = 0, j = 0, n = wishlist.length; j < 100 && i < n; ++i) {
						game = wishlist[i];
						if (game.name.toLowerCase().match(value)) {
							users = [];
							game.wishlists.forEach((k) => {
								user = glwc.users[k];
								users.push(
									`<a class="table__column__secondary-link" href="http://steamcommunity.com/profiles/${user.steamId}/wishlists">${user.username}</a>`
								);
							});
							const popout = createTooltip(
								createElements(wishlistSearch, 'beforeend', [
									{
										attributes: {
											class: 'table__row-outer-wrap',
										},
										type: 'div',
										children: [
											{
												attributes: {
													class: 'table__row-inner-wrap',
												},
												type: 'div',
												children: [
													{
														attributes: {
															class: 'table__column--width-small text-center',
														},
														type: 'div',
														children: [
															{
																attributes: {
																	class: 'table__column__rank',
																},
																text: '-',
																type: 'span',
															},
														],
													},
													{
														type: 'div',
														children: [
															{
																attributes: {
																	class: 'table_image_thumbnail',
																	style: `background-image:url(${game.logo});`,
																},
																type: 'div',
															},
														],
													},
													{
														attributes: {
															class: 'table__column--width-fill',
														},
														type: 'div',
														children: [
															{
																attributes: {
																	class: 'table__column__heading',
																},
																text: game.name,
																type: 'p',
															},
															{
																type: 'p',
																children: [
																	{
																		attributes: {
																			class: 'table__column__secondary-link',
																			href: `http://store.steampowered.com/app/${game.id}`,
																			rel: 'nofollow',
																			target: '_blank',
																		},
																		text: `http://store.steampowered.com/app/${game.id}`,
																		type: 'a',
																	},
																],
															},
														],
													},
													{
														attributes: {
															class: 'table__column--width--small text-center',
														},
														type: 'div',
														children: [
															{
																attributes: {
																	class: 'table__column__secondary-link esgst-clickable',
																},
																text: `${game.wishlists.length} (${
																	Math.round((game.wishlists.length / glwc.memberCount) * 10000) /
																	100
																}%)`,
																type: 'span',
															},
														],
													},
												],
											},
										],
									},
								]).firstElementChild.lastElementChild.firstElementChild,
								users.join(`, `),
								true
							);
							popout.onFirstOpen = () => Shared.common.endless_load(popout.popout);
							j += 1;
						}
					}
					if (!wishlistSearch.innerHTML) {
						createElements(wishlistSearch, 'atinner', [
							{
								text: 'Nothing found...',
								type: 'node',
							},
						]);
					}
				}
				wishlistSearch.classList.remove('esgst-hidden');
				wishlistResults.classList.add('esgst-hidden');
			} else {
				wishlistResults.classList.remove('esgst-hidden');
				wishlistSearch.classList.add('esgst-hidden');
			}
		});
	}
}

const groupsGroupLibraryWishlistChecker = new GroupsGroupLibraryWishlistChecker();

export { groupsGroupLibraryWishlistChecker };
