import dateFns_differenceInDays from 'date-fns/differenceInDays';
import { DOM } from '../../class/DOM';
import { EventDispatcher } from '../../class/EventDispatcher';
import { FetchRequest } from '../../class/FetchRequest';
import { Logger } from '../../class/Logger';
import { Module } from '../../class/Module';
import { permissions } from '../../class/Permissions';
import { Popout } from '../../class/Popout';
import { Popup } from '../../class/Popup';
import { Settings } from '../../class/Settings';
import { Shared } from '../../class/Shared';
import { Tabs } from '../../class/Tabs';
import { ToggleSwitch } from '../../class/ToggleSwitch';
import { Button } from '../../components/Button';
import { NotificationBar } from '../../components/NotificationBar';
import { PageHeading } from '../../components/PageHeading';
import { Events } from '../../constants/Events';
import { Utils } from '../../lib/jsUtils';
import { common } from '../Common';

const buildGiveaway = common.buildGiveaway.bind(common),
	createElements = common.createElements.bind(common),
	createHeadingButton = common.createHeadingButton.bind(common),
	endless_load = common.endless_load.bind(common);
class GiveawaysGiveawayExtractor extends Module {
	constructor() {
		super();
		this.info = {
			description: () => (
				<ul>
					<li>
						Adds a button (<i className="fa fa-gift"></i> <i className="fa fa-search"></i>) to the
						main page heading of any giveaway/discussion page that allows you to extract all of the
						giveaways that are linked in the page.
					</li>
					<li>
						The giveaways are extracted recursively. For example, if giveaway A has links to
						giveaways B and C, the feature will extract giveaway B and all of the giveaways linked
						in it before moving on to giveaway C, and so on.
					</li>
					<li>
						The feature keeps extracting giveaways until it no longer finds a giveaway link in the
						page. To prevent a loop (and consequently duplicate results), it keeps track of which
						giveaways it has already extracted so that they are not extracted again.
					</li>
					<li>
						If you use the feature in a giveaway page, it will add a "Bump" link to the results
						(when available).
					</li>
					<li>
						This feature is useful for extracting trains (multiple giveaways linked to each other).
					</li>
				</ul>
			),
			features: {
				ge_j: {
					name: 'Convert all Jigidi links to the "jigidi.com/jigsaw-puzzle" format.',
					sg: true,
				},
				ge_sgt: {
					conflicts: ['ge_sgtga'],
					features: {
						ge_sgt_l: {
							inputItems: [
								{
									id: 'ge_sgt_limit',
									prefix: `Limit: `,
								},
							],
							name: 'Limit how many links are opened.',
							sg: true,
						},
					},
					name: 'Automatically open any SGTools links found in new tabs.',
					sg: true,
				},
				ge_sgtga: {
					conflicts: ['ge_sgt'],
					features: {
						ge_sgtga_u: {
							name: 'Automatically unlock SGTools giveaways that have not yet been unlocked.',
							sg: true,
						},
					},
					name:
						'Automatically retrieve the giveaway link from SGTools giveaways that have already been unlocked.',
					sg: true,
				},
				ge_t: {
					name: 'Open the extractor in a new tab.',
					sg: true,
				},
				ge_a: {
					description: () => (
						<ul>
							<li>
								Disabling this allows you to configure the options for the extractor before starting
								it.
							</li>
						</ul>
					),
					name: 'Automatically start extracting when the popup opens.',
					sg: true,
				},
			},
			inputItems: [
				{
					id: 'npth_nextRegex',
					prefix: `Enter the regex you want to use to detect next links when extracting onwards: `,
				},
			],
			id: 'ge',
			name: 'Giveaway Extractor',
			sg: true,
			type: 'giveaways',
		};
	}

	async init() {
		EventDispatcher.subscribe(Events.GIVEAWAY_ENTER, this.updateCache);
		EventDispatcher.subscribe(Events.GIVEAWAY_LEAVE, this.updateCache);
		if (
			((this.esgst.giveawayCommentsPath && !document.getElementsByClassName('table--summary')[0]) ||
				this.esgst.discussionPath) &&
			this.checkGiveaways()
		) {
			this.nextRegex = new RegExp(Settings.get('npth_nextRegex'));

			// noinspection JSIgnoredPromiseFromCall
			this.ge_addButton();
		} else if (Shared.common.isCurrentPath('Account') && this.esgst.parameters.esgst === 'ge') {
			this.nextRegex = new RegExp(Settings.get('npth_nextRegex'));

			const parameters = Utils.getQueryParams();
			if (!parameters.url.match(/(^\/|www\.steamgifts\.com)/)) {
				if (!(await permissions.contains([['allUrls']]))) {
					window.alert('Giveaway Extractor: Not enough permissions to proceed.');
					return;
				}
			}

			this.ge = {
				context: (
					await FetchRequest.get(
						`${parameters.url}${parameters.page ? `/search?page=${parameters.page}` : ''}`
					)
				).html,
			};

			Shared.esgst.customPages.ge = {
				check: true,
				load: this.ge_openPopup.bind(this, this.ge),
			};
		}
	}

	updateCache = async (giveaway) => {
		this.ge.cache = JSON.parse(common.getValue('geCache', '{}'));
		if (giveaway.code in this.ge.cache[this.ge.cacheId].giveaways) {
			const cacheGiveaway = this.ge.cache[this.ge.cacheId].giveaways[giveaway.code];
			if (giveaway.entered) {
				cacheGiveaway.html = cacheGiveaway.html
					.replace(/"giveaway__row-outer-wrap"/, '"giveaway__row-outer-wrap" data-entered="true"')
					.replace(/"giveaway__row-inner-wrap\s?"/, '"giveaway__row-inner-wrap is-faded"');
			} else {
				cacheGiveaway.html = cacheGiveaway.html
					.replace(/\sdata-entered="true"/, '')
					.replace(/"giveaway__row-inner-wrap\sis-faded"/, '"giveaway__row-inner-wrap"');
			}
			await common.setValue('geCache', JSON.stringify(this.ge.cache));
		}
	};

	ge_addButton() {
		this.ge = {
			button: createHeadingButton({
				id: 'ge',
				icons: ['fa-gift', 'fa-search'],
				title: 'Extract all giveaways',
				link: Settings.get('ge_t')
					? `https://www.steamgifts.com/account/settings/profile?esgst=ge&url=${window.location.pathname.replace(
							/\/search.*/,
							''
					  )}${this.esgst.parameters.page ? `&page=${this.esgst.parameters.page}` : ''}`
					: '',
			}),
		};
		if (!Settings.get('ge_t')) {
			this.ge.button.addEventListener('click', () => this.ge_openPopup(this.ge));
		}
	}

	async ge_openPopup(ge) {
		if (ge.popup) {
			ge.popup.open();
			return;
		}
		const now = Date.now();
		let changed = false;
		ge.cache = JSON.parse(common.getValue('geCache', '{}'));
		for (const id in ge.cache) {
			if (dateFns_differenceInDays(now, ge.cache[id].timestamp) > 7) {
				changed = true;
				delete ge.cache[id];
			}
		}
		if (changed) {
			await common.setValue('geCache', JSON.stringify(ge.cache));
		}
		const urlMatch =
			this.esgst.parameters.url &&
			this.esgst.parameters.url.match(/^\/(giveaway|discussion)\/.+?\//);
		const pathMatch = window.location.pathname.match(/^\/(giveaway|discussion)\/.+?\//);
		ge.cacheId =
			(this.esgst.parameters.url && ((urlMatch && urlMatch[0]) || this.esgst.parameters.url)) ||
			(pathMatch && pathMatch[0]);
		ge.count = 0;
		ge.endless = 0;
		ge.total = 0;
		ge.extracted = [];
		ge.bumpLink = '';
		ge.points = 0;
		ge.sgToolsCount = 0;
		ge.isDivided =
			!Settings.get('es') ||
			!Settings.get('es_ge') ||
			Settings.get('gc_gi') ||
			Settings.get('gc_r') ||
			Settings.get('gc_rm') ||
			Settings.get('gc_ea') ||
			Settings.get('gc_tc') ||
			Settings.get('gc_a') ||
			Settings.get('gc_mp') ||
			Settings.get('gc_sc') ||
			Settings.get('gc_l') ||
			Settings.get('gc_m') ||
			Settings.get('gc_dlc') ||
			Settings.get('gc_rd') ||
			Settings.get('gc_g');
		if (Shared.common.isCurrentPath('Account') && this.esgst.parameters.esgst === 'ge') {
			const context = this.esgst.sidebar.nextElementSibling;
			if (Settings.get('removeSidebarInFeaturePages')) {
				this.esgst.sidebar.remove();
			}
			context.setAttribute('data-esgst-popup', 'true');
			context.innerHTML = '';
			ge.heading = PageHeading.create('ge', [
				{
					name: 'ESGST',
					url: this.esgst.settingsUrl,
				},
				{
					name: 'Giveaway Extractor',
					url: `https://www.steamgifts.com/account/settings/profile?esgst=ge`,
				},
			]).insert(context, 'beforeend');
			const container = createElements(context, 'beforeend', [{ type: 'div' }]);
			const scrollable = createElements(context, 'beforeend', [{ type: 'div' }]);
			ge.popup = {
				description: container,
				scrollable: scrollable,
				open: () => {},
				reposition: () => {},
			};
		} else {
			ge.popup = new Popup({ addScrollable: true });
			ge.heading = PageHeading.create('ge', ['Extract giveaways']).insert(
				ge.popup.description,
				'afterbegin'
			);
		}
		ge.results = createElements(ge.popup.scrollable, 'beforeend', [
			{
				attributes: {
					class: 'esgst-text-left',
				},
				type: 'div',
			},
		]);
		if (Settings.get('gas') || (Settings.get('gf') && Settings.get('gf_m')) || Settings.get('mm')) {
			if (Settings.get('gas')) {
				this.esgst.modules.giveawaysGiveawaysSorter.init(ge.heading.nodes.outer);
			}
			if (Settings.get('gf') && Settings.get('gf_m')) {
				ge.heading.nodes.outer.appendChild(
					this.esgst.modules.giveawaysGiveawayFilters.filters_addContainer(
						ge.heading.nodes.outer,
						'Ge'
					)
				);
			}
			if (Settings.get('mm')) {
				this.esgst.modules.generalMultiManager.mm(ge.heading.nodes.outer);
			}
		}
		const optionsButton = Button.create({
			color: 'alternate-white',
			tooltip: 'Options',
			icons: ['fa-gear'],
		}).insert(ge.heading.nodes.outer, 'beforeend');
		const popout = new Popout('', optionsButton.nodes.outer, 0, true);
		new ToggleSwitch(
			popout.popout,
			'ge_extractOnward',
			null,
			'Only extract from the current giveaway onward.',
			false,
			false,
			`With this option enabled, if you are in the 6th giveaway of a train that has links to the previous giveaways, the extractor will not go back and extract giveaways 1-5. This method is not 100% accurate, because the feature looks for a link with any variation of "next" in the description of the giveaway to make sure that it is going forward, so if it does not find such a link, the extraction will stop.`,
			Settings.get('ge_extractOnward')
		);
		common.observeNumChange(
			new ToggleSwitch(
				popout.popout,
				'ge_flushCache',
				null,
				(
					<fragment>
						Flush the cache if it is older than{' '}
						<input
							className="esgst-switch-input"
							step="0.1"
							type="number"
							value={Settings.get('ge_flushCacheHours')}
						/>{' '}
						hours.
					</fragment>
				),
				false,
				false,
				null,
				Settings.get('ge_flushCache')
			).name.firstElementChild,
			'ge_flushCacheHours',
			true
		);
		new ToggleSwitch(
			popout.popout,
			'ge_ignoreDiscussionComments',
			null,
			'Ignore discussion comments when extracting giveaways.',
			false,
			false,
			null,
			Settings.get('ge_ignoreDiscussionComments')
		);
		new ToggleSwitch(
			popout.popout,
			'ge_ignoreGiveawayComments',
			null,
			'Ignore giveaway comments when extracting giveaways.',
			false,
			false,
			null,
			Settings.get('ge_ignoreGiveawayComments')
		);
		ge.extractOnward = Settings.get('ge_extractOnward');
		ge.flushCache = Settings.get('ge_flushCache');
		ge.flushCacheHours = Settings.get('ge_flushCacheHours');
		ge.ignoreDiscussionComments = Settings.get('ge_ignoreDiscussionComments');
		ge.ignoreGiveawayComments = Settings.get('ge_ignoreGiveawayComments');
		ge.cacheWarning = null;
		const onExtractClick = () => {
			return new Promise((resolve) => {
				if (ge.hasScrolled && ge.isComplete) {
					resolve();
					return;
				}
				ge.hasScrolled = false;
				ge.isComplete = false;
				if (ge.cacheWarning || ge.reExtract) {
					if (ge.reExtract) {
						ge.extractOnward = Settings.get('ge_extractOnward');
						ge.ignoreDiscussionComments = Settings.get('ge_ignoreDiscussionComments');
						ge.ignoreGiveawayComments = Settings.get('ge_ignoreGiveawayComments');
						ge.count = 0;
						ge.endless = 0;
						ge.total = 0;
						ge.extracted = [];
						ge.bumpLink = '';
						ge.points = 0;
						ge.sgToolsCount = 0;
					}
					ge.flushCache = true;
					ge.flushCacheHours = 0;
					ge.reExtract = false;
					if (ge.cacheWarning) {
						ge.cacheWarning.remove();
					}
					ge.cacheWarning = null;
					ge.results.innerHTML = '';
					ge.cache[ge.cacheId] = {
						codes: [],
						giveaways: {},
						bumpLink: '',
						ithLinks: new Set(),
						jigidiLinks: new Set(),
						timestamp: now,
					};
				}
				ge.mainCallback = resolve;
				if (ge.callback) {
					ge.progressBar.setLoading();
					ge.callback();
				} else {
					ge.isCanceled = false;
					if (ge.button) {
						ge.button.classList.add('esgst-busy');
					}
					ge.progressBar
						.setLoading(
							<fragment>
								<span ref={(ref) => (ge.progressBarCounter = ref)}>{ge.total}</span> giveaways
								extracted.
							</fragment>
						)
						.show();
					let giveaways = this.ge_getGiveaways(
						ge,
						Shared.common.isCurrentPath('Account') && this.esgst.parameters.esgst === 'ge'
							? ge.context
							: this.esgst.pageOuterWrap
					);
					this.ge_extractGiveaways(
						ge,
						giveaways,
						0,
						giveaways.length,
						this.ge_completeExtraction.bind(this, ge)
					);
				}
			});
		};
		const onCancelClick = () => {
			ge.mainCallback = null;
			ge.isCanceled = true;
			// noinspection JSIgnoredPromiseFromCall
			this.ge_completeExtraction(ge);
		};
		ge.extractButton = Button.create([
			{
				color: 'green',
				icons: ['fa-search'],
				name: 'Extract',
				switchTo: { onReturn: 1 },
				onClick: onExtractClick,
			},
			{
				template: 'error',
				name: 'Cancel',
				switchTo: { onReturn: 0 },
				onClick: onCancelClick,
			},
			{
				color: 'green',
				icons: ['fa-search'],
				name: 'Extract More',
				switchTo: { onReturn: 3 },
				onClick: onExtractClick,
			},
			{
				template: 'error',
				name: 'Cancel',
				switchTo: { onReturn: 0 },
				onClick: onCancelClick,
			},
			{
				color: 'green',
				icons: ['fa-search'],
				name: 'Re-Extract',
				switchTo: { onReturn: 5 },
				onClick: onExtractClick,
			},
			{
				template: 'error',
				name: 'Cancel',
				switchTo: { onReturn: 0 },
				onClick: onCancelClick,
			},
		]).insert(ge.heading.nodes.outer, 'beforeend');
		ge.progressBar = NotificationBar.create().insert(ge.popup.description, 'beforeend').hide();
		ge.popup.open();
		if (
			ge.flushCache &&
			ge.cache[ge.cacheId] &&
			now - ge.cache[ge.cacheId].timestamp > parseInt(ge.flushCacheHours) * 3600000
		) {
			delete ge.cache[ge.cacheId];
		}
		if (!ge.extractOnward && ge.cache[ge.cacheId]) {
			ge.cache[ge.cacheId].ithLinks = new Set(ge.cache[ge.cacheId].ithLinks);
			ge.cache[ge.cacheId].jigidiLinks = new Set(ge.cache[ge.cacheId].jigidiLinks);
			DOM.insert(
				ge.popup.description,
				'beforeend',
				<div ref={(ref) => (ge.cacheWarning = ref)}>
					{`These results were retrieved from the cache from ${common.getTimeSince(
						ge.cache[ge.cacheId].timestamp
					)} ago (${this.esgst.modules.generalAccurateTimestamp.at_formatTimestamp(
						ge.cache[ge.cacheId].timestamp
					)}). If you want to update the cache, you will have to extract again.`}
				</div>
			);

			let html = '';
			let points = 0;
			let total = 0;
			for (const code of ge.cache[ge.cacheId].codes) {
				if (total % 50 === 0) {
					html = '';
				}

				const giveaway = ge.cache[ge.cacheId].giveaways[code];
				if (giveaway) {
					html += giveaway.html;
					points += giveaway.points;
					total += 1;
				} else if (
					Settings.get('ge_sgt') &&
					(!Settings.get('ge_sgt_l') || ge.sgToolsCount < Settings.get('ge_sgt_limit'))
				) {
					Tabs.open(`https://www.sgtools.info/giveaways/${code}`);
					ge.sgToolsCount += 1;
				}

				if (total % 50 === 0) {
					ge.results.insertAdjacentHTML('beforeend', html);
					ge.results.lastElementChild.classList.add(`esgst-es-page-${ge.endless}`);
					await Shared.common.timeout(100);
				}
			}
			if (total % 50 !== 0) {
				ge.results.insertAdjacentHTML('beforeend', html);
				ge.results.lastElementChild.classList.add(`esgst-es-page-${ge.endless}`);
			}
			ge.progressBar
				.setInfo(
					<fragment>
						<span ref={(ref) => (ge.progressBarCounter = ref)}>{ge.total}</span> giveaways
						extracted.
					</fragment>
				)
				.show();
			ge.progressBarCounter.textContent = total;
			await endless_load(ge.results, false, 'ge', ge.endless);
			const items = [
				{
					attributes: {
						class: 'markdown esgst-text-center',
					},
					type: 'div',
					children: [],
				},
			];
			if (ge.cache[ge.cacheId].bumpLink && !this.esgst.discussionPath) {
				items[0].children.push({
					type: 'h2',
					children: [
						{
							attributes: {
								href: ge.cache[ge.cacheId].bumpLink,
							},
							text: 'Bump',
							type: 'a',
						},
					],
				});
			}
			items[0].children.push({
				text: `${points}P required to enter all giveaways.`,
				type: 'node',
			});
			for (let link of [...ge.cache[ge.cacheId].ithLinks, ...ge.cache[ge.cacheId].jigidiLinks]) {
				if (Settings.get('ge_j')) {
					const id = this.extractJigidiId(link);
					if (id) {
						link = `https://www.jigidi.com/jigsaw-puzzle/${id}`;
					}
				}
				items[0].children.push(
					{
						type: 'br',
					},
					{
						attributes: {
							href: link,
						},
						text: link,
						type: 'a',
					}
				);
			}
			createElements(ge.results, 'afterbegin', items);
			createElements(ge.results, 'beforeend', items);
		} else {
			ge.cache[ge.cacheId] = {
				codes: [],
				giveaways: {},
				bumpLink: '',
				ithLinks: new Set(),
				jigidiLinks: new Set(),
				timestamp: now,
			};
			if (Settings.get('ge_a')) {
				ge.extractButton.onClick();
			}
		}
		if (Settings.get('es') && Settings.get('es_ge')) {
			ge.popup.scrollable.addEventListener('scroll', this.checkScroll.bind(this, ge));
		}
	}

	checkScroll(ge, filtered) {
		if (
			!ge.cacheWarning &&
			!ge.isCanceled &&
			ge.extractButton &&
			!ge.extractButton.isBusy &&
			(ge.popup.scrollable.scrollTop + ge.popup.scrollable.offsetHeight >=
				ge.popup.scrollable.scrollHeight ||
				filtered)
		) {
			ge.hasScrolled = true;
			ge.extractButton.onClick();
		}
	}

	ge_extractGiveaways(ge, giveaways, i, n, callback) {
		if (!ge.isCanceled) {
			if (i < n) {
				// noinspection JSIgnoredPromiseFromCall
				this.ge_extractGiveaway(ge, giveaways[i], () =>
					window.setTimeout(this.ge_extractGiveaways.bind(this), 0, ge, giveaways, ++i, n, callback)
				);
			} else {
				callback();
			}
		}
	}

	async ge_extractGiveaway(ge, code, callback) {
		if (!ge.isCanceled) {
			if (ge.isDivided && ge.count === 50) {
				let children, filtered, i;
				ge.mainCallback();
				ge.mainCallback = null;
				ge.count = 0;
				await endless_load(ge.results, false, 'ge', ge.endless);
				ge.extractButton.build(3);
				ge.progressBar.setInfo();
				ge.callback = this.ge_extractGiveaway.bind(this, ge, code, callback);
				filtered = false;
				children = ge.results.querySelectorAll(`:scope > .esgst-es-page-${ge.endless}`);
				for (i = children.length - 1; i > -1 && !filtered; --i) {
					if (children[i].firstElementChild.classList.contains('esgst-hidden')) {
						filtered = true;
					}
				}
				ge.endless++;
				if (Settings.get('es') && Settings.get('es_ge')) {
					this.checkScroll(ge, filtered);
				}
			} else {
				if (ge.extracted.indexOf(code) < 0) {
					let sgTools = code.length > 5;
					if (sgTools) {
						if (
							Settings.get('ge_sgt') &&
							(!Settings.get('ge_sgt_l') || ge.sgToolsCount < Settings.get('ge_sgt_limit'))
						) {
							Tabs.open(`https://www.sgtools.info/giveaways/${code}`);
							ge.cache[ge.cacheId].codes.push(code);
							ge.extracted.push(code);
							ge.sgToolsCount += 1;
							callback();
							return;
						}
						if (Settings.get('ge_sgtga')) {
							try {
								if (Settings.get('ge_sgtga_u')) {
									await FetchRequest.get(`https://www.sgtools.info/giveaways/${code}/check`, {
										queue: true,
									});
								}
								const response = await FetchRequest.get(
									`https://www.sgtools.info/giveaways/${code}/getLink`,
									{
										queue: true,
									}
								);
								if (response.json && response.json.url) {
									ge.extracted.push(code);
									code = response.json.url.match(/\/giveaway\/(.{5})/)[1];
									sgTools = false;
								}
							} catch (error) {
								Logger.warning(error.message, error.stack);
							}
						}
					}
					if (ge.extracted.indexOf(code) < 0) {
						let bumpLink, button, giveaway, giveaways, n, responseHtml;
						try {
							let response = await FetchRequest.get(
								sgTools ? `https://www.sgtools.info/giveaways/${code}` : `/giveaway/${code}/`
							);
							responseHtml = response.html;
							button = responseHtml.getElementsByClassName('sidebar__error')[0];
							giveaway = await buildGiveaway(
								responseHtml,
								response.url,
								button && button.textContent
							);
						} catch (error) {}
						if (ge.isCanceled) {
							return;
						}
						if (giveaway) {
							createElements(ge.results, 'beforeend', giveaway.html);
							ge.results.lastElementChild.classList.add(`esgst-es-page-${ge.endless}`);
							giveaway.html = ge.results.lastElementChild.outerHTML;
							ge.cache[ge.cacheId].codes.push(code);
							ge.cache[ge.cacheId].giveaways[code] = giveaway;
							ge.points += giveaway.points;
							ge.count += 1;
							ge.total += 1;
							ge.progressBarCounter.textContent = ge.total;
							ge.extracted.push(code);
							if (sgTools) {
								callback();
							} else {
								if (!ge.bumpLink) {
									bumpLink = responseHtml.querySelector(`[href*="/discussion/"]`);
									if (bumpLink) {
										ge.bumpLink = bumpLink.getAttribute('href');
										ge.cache[ge.cacheId].bumpLink = ge.bumpLink;
									}
								}
								giveaways = this.ge_getGiveaways(ge, responseHtml);
								n = giveaways.length;
								if (n > 0) {
									window.setTimeout(
										() => this.ge_extractGiveaways(ge, giveaways, 0, n, callback),
										0
									);
								} else {
									callback();
								}
							}
						} else if (!sgTools) {
							let bumpLink, giveaway, giveaways, n, responseHtml;
							try {
								let response = await FetchRequest.get(`/giveaway/${code}/`, {
									anon: true,
								});
								responseHtml = response.html;
								giveaway = await buildGiveaway(responseHtml, response.url, null, true);
							} catch (error) {}
							if (giveaway) {
								createElements(ge.results, 'beforeend', giveaway.html);
								ge.results.lastElementChild.classList.add(`esgst-es-page-${ge.endless}`);
								giveaway.html = ge.results.lastElementChild.outerHTML;
								ge.cache[ge.cacheId].codes.push(code);
								ge.cache[ge.cacheId].giveaways[code] = giveaway;
								ge.points += giveaway.points;
								ge.count += 1;
								ge.total += 1;
								ge.progressBarCounter.textContent = ge.total;
								ge.extracted.push(code);
								if (!ge.bumpLink) {
									bumpLink = responseHtml.querySelector(`[href*="/discussion/"]`);
									if (bumpLink) {
										ge.bumpLink = bumpLink.getAttribute('href');
										ge.cache[ge.cacheId].bumpLink = ge.bumpLink;
									}
								}
								giveaways = this.ge_getGiveaways(ge, responseHtml);
								n = giveaways.length;
								if (n > 0) {
									window.setTimeout(
										() => this.ge_extractGiveaways(ge, giveaways, 0, n, callback),
										0
									);
								} else {
									callback();
								}
							} else {
								callback();
							}
						} else {
							callback();
						}
					} else {
						callback();
					}
				} else {
					callback();
				}
			}
		}
	}

	ge_getGiveaways(ge, context) {
		const giveawaySelectors = [
			`img[title]`,
			`[href*="/giveaway/"]`,
			`[href*="sgtools.info/giveaways"]`,
		];
		let giveaways = [];
		if (context === ge.context) {
			let match = Utils.getQueryParams().url.match(/\/giveaway\/(.+?)\//);
			if (match) {
				giveaways.push(match[1]);
			}
		} else if (context === this.esgst.pageOuterWrap && this.esgst.giveawayPath) {
			let match = Shared.esgst.locationHref.match(/\/giveaway\/(.+?)\//);
			if (match) {
				giveaways.push(match[1]);
			}
		}

		const next = {
			code: null,
			count: 0,
		};

		const description = context.querySelector('.page__description');
		const op = context.querySelector('.markdown');
		const commentElements = context.querySelectorAll('.comments');

		let elements;

		if (description) {
			elements = description.querySelectorAll(giveawaySelectors.join(', '));

			for (const element of elements) {
				this.ge_getGiveaway(element, ge, giveaways, next);
			}

			if (!ge.ignoreGiveawayComments && commentElements.length > 0) {
				elements = commentElements[commentElements.length - 1].querySelectorAll(
					giveawaySelectors.map((x) => `.markdown ${x}`).join(', ')
				);

				for (const element of elements) {
					this.ge_getGiveaway(element, ge, giveaways);
				}
			}
		} else if (op) {
			elements = op.querySelectorAll(giveawaySelectors.join(', '));

			for (const element of elements) {
				this.ge_getGiveaway(element, ge, giveaways, next);
			}

			if (!ge.ignoreDiscussionComments && commentElements.length > 0) {
				elements = commentElements[commentElements.length - 1].querySelectorAll(
					giveawaySelectors.map((x) => `.markdown ${x}`).join(', ')
				);

				for (const element of elements) {
					this.ge_getGiveaway(element, ge, giveaways);
				}
			}
		} else {
			elements = context.querySelectorAll(giveawaySelectors.join(', '));

			for (const element of elements) {
				this.ge_getGiveaway(element, ge, giveaways, next);
			}
		}
		if (next.count > 0) {
			giveaways.push(next.code);
		}
		const ithSelectors = [`[href*="itstoohard.com/puzzle/"]`];
		let ithLinks;
		if (ge.ignoreDiscussionComments && !description && op) {
			ithLinks = op.querySelectorAll(ithSelectors.join(`, `));
		} else if (ge.ignoreGiveawayComments && description) {
			ithLinks = description.querySelectorAll(ithSelectors.join(`, `));
		} else {
			ithLinks = context.querySelectorAll(ithSelectors.map((x) => `.markdown ${x}`).join(`, `));
		}
		for (const link of ithLinks) {
			const url = link.getAttribute('href');
			ge.cache[ge.cacheId].ithLinks.add(url);
		}
		const jigidiSelectors = [
			'[href*="jigidi.com/jigsaw-puzzle"]',
			'[href*="jigidi.com/solve"]',
			'[href*="jigidi.com/created"]',
		];
		let jigidiLinks;
		if (ge.ignoreDiscussionComments && !description && op) {
			jigidiLinks = op.querySelectorAll(jigidiSelectors.join(`, `));
		} else if (ge.ignoreGiveawayComments && description) {
			jigidiLinks = description.querySelectorAll(jigidiSelectors.join(`, `));
		} else {
			jigidiLinks = context.querySelectorAll(
				jigidiSelectors.map((x) => `.markdown ${x}`).join(`, `)
			);
		}
		for (const link of jigidiLinks) {
			let url = link.getAttribute('href');
			if (Settings.get('ge_j')) {
				const id = this.extractJigidiId(url);
				if (id) {
					url = `https://www.jigidi.com/jigsaw-puzzle/${id}`;
				}
			}
			ge.cache[ge.cacheId].jigidiLinks.add(url);
		}
		return giveaways;
	}

	ge_getGiveaway(element, ge, giveaways, next) {
		if (element.matches('img')) {
			const title = element.getAttribute('title');

			if (title.length === 5) {
				if (ge.extracted.indexOf(title) < 0 && giveaways.indexOf(title) < 0) {
					giveaways.push(title);
				}
			}

			return;
		}

		const url = element.getAttribute('href');
		let match = url.match(/\/(\w{5})\b/);

		if (!match) {
			match = url.match(/(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})/);

			if (!match) {
				return;
			}
		}

		const code = match[1];

		if (
			!next ||
			!ge.extractOnward ||
			this.esgst.discussionPath ||
			element.textContent.toLowerCase().match(this.nextRegex)
		) {
			if (ge.extracted.indexOf(code) < 0 && giveaways.indexOf(code) < 0) {
				giveaways.push(code);
			}
		} else {
			match = element.textContent.match(/\d+/);

			if (match) {
				const count = parseInt(match[0]);

				if (count > next.count && ge.extracted.indexOf(code) < 0 && giveaways.indexOf(code) < 0) {
					next.code = code;
					next.count = count;
				}
			}
		}
	}

	checkGiveaways() {
		let isFound = false;
		const elements = document.querySelectorAll(
			`.markdown img[title], .markdown [href*="/giveaway/"], .markdown [href*="sgtools.info/giveaways"]`
		);
		for (const element of elements) {
			if (element.matches('img')) {
				if (element.getAttribute('title').length === 5) {
					isFound = true;
				}
			} else {
				return true;
			}
		}
		return isFound;
	}

	async ge_completeExtraction(ge) {
		if (ge.button) {
			ge.button.classList.remove('esgst-busy');
		}
		ge.progressBar.setSuccess();
		if (ge.mainCallback) {
			ge.mainCallback();
			ge.mainCallback = null;
		}
		await endless_load(ge.results, false, 'ge', ge.endless);
		const items = [
			{
				attributes: {
					class: 'markdown esgst-text-center',
				},
				type: 'div',
				children: [],
			},
		];
		if (ge.bumpLink && !this.esgst.discussionPath) {
			items[0].children.push({
				type: 'h2',
				children: [
					{
						attributes: {
							href: ge.bumpLink,
						},
						text: 'Bump',
						type: 'a',
					},
				],
			});
		}
		items[0].children.push({
			text: `${ge.points}P required to enter all giveaways.`,
			type: 'node',
		});
		for (const link of [...ge.cache[ge.cacheId].ithLinks, ...ge.cache[ge.cacheId].jigidiLinks]) {
			items[0].children.push(
				{
					type: 'br',
				},
				{
					attributes: {
						href: link,
					},
					text: link,
					type: 'a',
				}
			);
		}
		createElements(ge.results, 'afterbegin', items);
		createElements(ge.results, 'beforeend', items);
		ge.extractButton.build(5);
		ge.reExtract = true;
		ge.isComplete = true;
		if (!ge.isCanceled && !ge.extractOnward) {
			ge.cache[ge.cacheId].ithLinks = Array.from(ge.cache[ge.cacheId].ithLinks);
			ge.cache[ge.cacheId].jigidiLinks = Array.from(ge.cache[ge.cacheId].jigidiLinks);
			await common.setValue('geCache', JSON.stringify(ge.cache));
		}
		$('.esgst-gv-icons [data-draggable-id]').removeClass('featured__column');
	}

	extractJigidiId(url) {
		const matches = url.match(/(jigsaw-puzzle|solve)\/([A-Za-z0-9]+)|id=([A-Za-z0-9]+)/);
		return matches[2] || matches[3];
	}
}

const giveawaysGiveawayExtractor = new GiveawaysGiveawayExtractor();

export { giveawaysGiveawayExtractor };
