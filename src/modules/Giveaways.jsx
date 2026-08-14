import { DOM } from '../class/DOM';
import { Module } from '../class/Module';
import { Scope } from '../class/Scope';
import { Settings } from '../class/Settings';
import { Shared } from '../class/Shared';
import { Button } from '../components/Button';
import { common } from './Common';

const createElements = common.createElements.bind(common),
	getFeatureTooltip = common.getFeatureTooltip.bind(common),
	getUser = common.getUser.bind(common),
	hideGame = common.hideGame.bind(common),
	sortContent = common.sortContent.bind(common);
class Giveaways extends Module {
	constructor() {
		super();
		this.info = {
			endless: true,
			id: 'giveaways',
			featureMap: {
				endless: this.giveaways_load.bind(this),
			},
		};
	}

	async giveaways_load(context, main, source, endless) {
		if (context.getAttribute && context.getAttribute('data-rfi')) return;
		let giveaways = await this.giveaways_get(context, main, null, false, null, false, endless);
		if (!giveaways.length) return;
		const lightbox = document.querySelector('.lightbox');
		if (!lightbox) {
			document.body.insertAdjacentHTML(
				'afterbegin',
				'<div class="lightbox hide"><div class="lightbox-header"><div class="lightbox-header-description"><div class="lightbox-header-description-name"></div><div class="lightbox-header-description-count"></div></div><div class="lightbox-header-icons"><i data-category="images" class="lightbox-header-icon fa fa-camera"></i><i data-category="videos" class="lightbox-header-icon fa fa-video-camera"></i><i class="lightbox-header-icon lightbox-header-icon--close fa fa-times"></i></div></div><div class="lightbox-status lightbox-status--loading"><div><div class="lightbox-status-icon"><i class="fa fa-cog fa-spin"></i></div><div class="lightbox-status-text">Please wait</div></div></div><div class="lightbox-status lightbox-status--empty"><div><div class="lightbox-status-icon"><i class="fa fa-picture-o"></i></div><div class="lightbox-status-text">No results</div></div></div><div class="lightbox-content"><div class="lightbox-content-nav"><div class="lightbox-content-nav-btn lightbox-content-nav-btn--prev"><div class="lightbox-content-nav-btn-icon"><i class="fa fa-angle-left"></i></div></div><div class="lightbox-content-nav-btn lightbox-content-nav-btn--next"><div class="lightbox-content-nav-btn-icon"><i class="fa fa-angle-right"></i></div></div></div><div class="lightbox-content-image"></div></div><div class="lightbox-footer-outer"><div class="lightbox-footer-inner"><div class="lightbox-thumbnails"></div></div></div></div>'
			);
		}
		let sortIndex = Scope.findData('current', 'giveaways').length;
		for (const giveaway of giveaways) {
			giveaway.sortIndex = sortIndex;
			sortIndex += 1;
		}
		Scope.addData('current', 'giveaways', giveaways, endless);
		for (let feature of this.esgst.giveawayFeatures) {
			await feature(giveaways, main, source);
		}
		giveaways.forEach((giveaway) => this.giveaways_reorder(giveaway));
		if (this.esgst.gas && Settings.get(this.esgst.gas.autoKey)) {
			sortContent(Scope.findData('current', 'giveaways'), Settings.get(this.esgst.gas.optionKey));
		}
		if (
			main &&
			Shared.esgst.gf &&
			this.esgst.gf.filteredCount &&
			Settings.get(`gf_enable${this.esgst.gf.type}`)
		) {
			this.esgst.modules.giveawaysGiveawayFilters.filters_filter(this.esgst.gf, false, endless);
		}
		if (
			!main &&
			this.esgst.gfPopup &&
			this.esgst.gfPopup.filteredCount &&
			Settings.get(`gf_enable${this.esgst.gfPopup.type}`)
		) {
			this.esgst.modules.giveawaysGiveawayFilters.filters_filter(this.esgst.gfPopup);
		}
		if (Settings.get('mm_enableGiveaways') && this.esgst.mm_enable) {
			this.esgst.mm_enable(Scope.findData('current', 'giveaways'), 'Giveaways');
		}
	}

	async giveaways_get(context, main, mainUrl, hr, key, ged, endless) {
		let giveaway, giveaways, i, mainContext, matches, query;
		giveaways = [];
		if (
			!hr &&
			main &&
			(this.esgst.createdPath ||
				this.esgst.enteredPath ||
				this.esgst.wonPath ||
				this.esgst.archivePath)
		) {
			query = Shared.common.getSelectors(endless, [
				'X.giveaway__row-outer-wrap',
				'X.featured__outer-wrap--giveaway',
				`.table:not(.table--summary) X.table__row-outer-wrap`,
			]);
		} else if (this.esgst.gamePath) {
			query = Shared.common.getSelectors(endless, ['X.giveaway__row-outer-wrap']);
		} else {
			query = Shared.common.getSelectors(endless, [
				'X.giveaway__row-outer-wrap',
				'X.featured__outer-wrap--giveaway',
			]);
		}
		if (key) {
			mainContext = context;
		} else {
			if (mainUrl) {
				mainContext = context;
				key = 'data';
			} else {
				mainContext = document;
				key = 'giveaway';
			}
		}
		matches = context.querySelectorAll(query);
		for (const match of matches) {
			giveaway = await this.giveaways_getInfo(
				match,
				mainContext,
				null,
				null,
				main,
				mainUrl,
				ged,
				endless
			);
			if (giveaway) {
				giveaways.push(giveaway[key]);
			}
		}
		return giveaways;
	}

	async giveaways_getInfo(context, mainContext, ugd, ugdType, main, mainUrl, ged, endless) {
		const currentPath = mainUrl ? common.getPath(mainUrl) : window.location.pathname;

		const paths = {
			giveaway: common.testPath('Giveaway', 'sg', currentPath),
			created: common.testPath('My Giveaways - Created', 'sg', currentPath),
			entered: common.testPath('My Giveaways - Entered', 'sg', currentPath),
			won: common.testPath('My Giveaways - Won', 'sg', currentPath),
			wishlist: common.testPath('Community Wishlist', 'sg', currentPath),
			archive: common.testPath('Archive', 'sg', currentPath),
			giveaways: common.testPath('Giveaways', 'sg', currentPath),
			game: common.testPath('Game', 'sg', currentPath),
			group: common.testPath('Group', 'sg', currentPath),
			user: common.testPath('User - Giveaways - Sent', 'sg', currentPath),
			userWon: common.testPath('User - Giveaways - Won', 'sg', currentPath),
		};

		if (context.classList.contains('table__row-outer-wrap') && paths.giveaway) {
			return;
		}

		const giveaway = {
			creators: [],
			groups: [],
			winners: [],
			outerWrap: context,
			gameId: context.getAttribute('data-game-id'),
		};

		const info = await this.esgst.modules.games.games_getInfo(giveaway.outerWrap);
		if (info) {
			giveaway.id = info.id;
			giveaway.type = info.type;

			const cachedGame = this.esgst.games?.[giveaway.type]?.[giveaway.id];
			if (cachedGame) {
				const gameKeys = [
					'owned', 'wishlisted', 'previouslyWishlisted', 'followed',
					'hidden', 'ignored', 'previouslyEntered', 'previouslyWon',
					'reducedCV', 'noCV', 'banned', 'removed',
				];

				for (const key of gameKeys) {
					if (key === 'banned' && Shared.esgst.delistedGames.banned.includes(parseInt(giveaway.id, 10))) {
						giveaway[key] = true;
					} else if (
						key === 'removed' &&
						(Shared.esgst.delistedGames.removed.includes(parseInt(giveaway.id, 10)) || cachedGame.removed)
					) {
						giveaway[key] = true;
					} else {
						const mappedKey = key === 'previouslyEntered' ? 'entered' : key === 'previouslyWon' ? 'won' : key;
						if (Shared.esgst.games?.[giveaway.type]?.[giveaway.id]?.[mappedKey]) {
							giveaway[key] = true;
						}
					}
				}
			}
		}

		giveaway.innerWrap = giveaway.outerWrap.querySelector(
			'.giveaway__row-inner-wrap, .featured__inner-wrap, .table__row-inner-wrap'
		);
		giveaway.avatar = giveaway.outerWrap.querySelector('.giveaway_image_avatar, .featured_giveaway_image_avatar');
		giveaway.image = giveaway.outerWrap.querySelector(
			'.giveaway_image_thumbnail, .giveaway_image_thumbnail_missing, .global__image-outer-wrap--game-medium'
		);
		giveaway.summary = giveaway.innerWrap?.querySelector(
			'.giveaway__summary, .featured__summary, .table__column--width-fill'
		);

		if (giveaway.outerWrap.getAttribute('data-entered')) {
			giveaway.entered = true;
		} else if (paths.giveaway && main) {
			const deleteButton = mainContext.getElementsByClassName('sidebar__entry-delete')[0];
			giveaway.entered = deleteButton ? !deleteButton.classList.contains('is-hidden') : false;
		} else if ((paths.entered || paths.won) && main) {
			giveaway.entered = true;
		} else {
			giveaway.entered = giveaway.innerWrap?.classList.contains('is-faded') ?? false;
		}

		giveaway.headingName = giveaway.innerWrap?.querySelector(
			'.giveaway__heading__name, .featured__heading__medium, .table__column__heading'
		);
		giveaway.heading = paths.wishlist ? giveaway.headingName : giveaway.headingName?.parentElement;
		giveaway.quickEntryWrap = giveaway.innerWrap?.querySelector('.giveaway__quick-entry-wrap') || null;
		giveaway.name = giveaway.headingName?.textContent || '';

		const copiesMatch = giveaway.name.match(/\s\((.+) Copies\)/);
		if (copiesMatch) {
			giveaway.name = giveaway.name.replace(copiesMatch[0], '');
			giveaway.copies = parseInt(copiesMatch[1].replace(/,/g, '').match(/\d+/)?.[0] || '1', 10);
		} else {
			giveaway.copies = 1;
		}

		giveaway.url = paths.giveaway && main && !ugd
			? currentPath
			: mainUrl || giveaway.headingName?.getAttribute('href');

		if (giveaway.url) {
			giveaway.url = giveaway.url.replace(/\/(entries|groups|region-restrictions|winners)$/, '');
			const codeMatch = giveaway.url.match(/\/giveaway\/(.+?)(\/.+?)$/);

			if (codeMatch) {
				giveaway.code = codeMatch[1];
			} else {
				const sgToolsMatch = giveaway.url.match(/\/giveaways\/(.+)/);
				if (sgToolsMatch) {
					giveaway.code = sgToolsMatch[1];
					giveaway.sgTools = true;
				} else {
					return;
				}
			}
		}

		giveaway.pinned = giveaway.outerWrap.closest('.pinned-giveaways');
		const thinHeadings = giveaway.innerWrap?.querySelectorAll(
			'.giveaway__heading__thin:not(.dyegb_playtime):not(.dyegb_achievement), .featured__heading__small'
		) || [];

		giveaway.points = 0;
		giveaway.copiesContainer = null;

		if (thinHeadings.length > 0) {
			if (thinHeadings.length > 1) {
				giveaway.copiesContainer = thinHeadings[0];
				giveaway.copies = parseInt(thinHeadings[0].textContent.replace(/,/g, '').match(/\d+/)?.[0] || '1', 10);
				giveaway.pointsContainer = thinHeadings[1];
				giveaway.points = parseInt(thinHeadings[1].textContent.match(/\d+/)?.[0] || '0', 10);
			} else {
				giveaway.copies = 1;
				giveaway.pointsContainer = thinHeadings[0];
				giveaway.points = parseInt(thinHeadings[0].textContent.match(/\d+/)?.[0] || '0', 10);
			}
		}

		giveaway.columns = giveaway.innerWrap?.querySelector('.giveaway__columns, .featured__columns');

		if (giveaway.columns && (!paths.archive || !main)) {
			giveaway.endTimeColumn = giveaway.columns.firstElementChild;

			if (giveaway.endTimeColumn?.classList.contains('esgst-ged-source')) {
				giveaway.sourceColumn = giveaway.endTimeColumn;
				giveaway.endTimeColumn = giveaway.sourceColumn.nextElementSibling;
			}

			giveaway.startTimeColumn = giveaway.columns.querySelector(
				'.giveaway__column--width-fill.text-right, .featured__column--width-fill.text-right'
			);
			giveaway.started = !giveaway.endTimeColumn?.textContent.includes('Begins');

			const endTimestamp = giveaway.endTimeColumn?.querySelector('[data-timestamp]');
			giveaway.endTime = endTimestamp ? parseInt(endTimestamp.getAttribute('data-timestamp'), 10) * 1000 : 0;
			giveaway.ended = Boolean(giveaway.deleted || giveaway.endTimeColumn?.textContent.includes('Ended'));

			const startTimestamp = giveaway.startTimeColumn?.querySelector('[data-timestamp]');
			giveaway.startTime = startTimestamp ? parseInt(startTimestamp.getAttribute('data-timestamp'), 10) * 1000 : 0;
			giveaway.creatorContainer = giveaway.startTimeColumn?.querySelector('a[href*="/user/"], a[style]') || null;
		} else {
			giveaway.started = true;
		}

		if (main && paths.archive) {
			giveaway.startTimeColumn = giveaway.innerWrap?.querySelector('[data-timestamp]');
			giveaway.startTime = giveaway.startTimeColumn
				? parseInt(giveaway.startTimeColumn.getAttribute('data-timestamp'), 10) * 1000
				: 0;
			giveaway.creatorContainer = giveaway.innerWrap?.querySelector('a[href*="/user/"]');
		}

		if (!giveaway.endTime && main && (paths.created || paths.entered || paths.won)) {
			giveaway.endTime = giveaway.innerWrap?.querySelector('[data-timestamp]');
			if (giveaway.endTime) {
				giveaway.endTimeColumn = giveaway.endTime.parentElement;
				giveaway.started = !giveaway.endTimeColumn.textContent.includes('Begins');
				giveaway.deleted = Boolean(giveaway.endTimeColumn.parentElement.textContent.includes('Deleted'));
				giveaway.endTime = parseInt(giveaway.endTime.getAttribute('data-timestamp'), 10) * 1000;
				giveaway.ended = Boolean(giveaway.deleted || giveaway.endTimeColumn.parentElement.textContent.includes('Ended'));
			} else {
				giveaway.endTime = 0;
				giveaway.ended = true;
			}
		}

		if (giveaway.creatorContainer) {
			giveaway.creator = giveaway.creatorContainer.textContent;
		} else if (ugd && ugdType === 'sent') {
			giveaway.creator = ugd;
		} else if (paths.user && !paths.userWon && main && !ged) {
			giveaway.creator = currentPath.match(/^\/user\/(.+?)(\/.*)?$/)?.[1];
		} else if (paths.created && main) {
			giveaway.creator = Settings.get('username');
		}

		if (giveaway.creator) {
			giveaway.creators.push(giveaway.creator.toLowerCase());
		}

		if (main) {
			if (paths.created) {
				const status = giveaway.outerWrap.querySelector('.table__column--width-small.text-center:last-of-type');
				if (status) {
					const text = status.textContent;
					if (/Not\sReceived/.test(text)) giveaway.notReceived = true;
					else if (/Received/.test(text)) giveaway.received = true;
					else if (/Awaiting\sFeedback/.test(text)) giveaway.awaitingFeedback = true;
				}
			} else if (paths.won) {
				giveaway.received = false;
				giveaway.notReceived = false;

				const elements = giveaway.outerWrap.querySelectorAll('.table__column--gift-feedback');
				for (const element of elements) {
					const text = element.textContent.trim();
					if (
						(text === 'Received' && element.querySelector('.icon-green')) ||
						element.querySelector('.table__gift-feedback-received:not(.is-hidden)')
					) {
						giveaway.received = true;
						break;
					}
					if (
						(text === 'Not Received' && element.querySelector('.icon-red')) ||
						element.querySelector('.table__gift-feedback-not-received:not(.is-hidden)')
					) {
						giveaway.notReceived = true;
						break;
					}
				}
				giveaway.awaitingFeedback = !giveaway.received && !giveaway.notReceived;
			}
		}

		giveaway.created = giveaway.creator === Settings.get('username');

		if (Settings.get('gf') && Settings.get('gf_s') && main) {
			const savedGiveaway = this.esgst.giveaways[giveaway.code];
			if (
				(paths.giveaways || paths.game || paths.group) &&
				savedGiveaway?.hidden &&
				savedGiveaway?.code &&
				savedGiveaway?.endTime > Date.now()
			) {
				giveaway.outerWrap.classList.add('esgst-hidden');
				giveaway.outerWrap.setAttribute('data-esgst-not-filterable', 'gf');
				if (Settings.get('gf_s_s')) {
					Shared.esgst.modules.giveawaysGiveawayFilters.updateSingleCounter();
				}
			}
		}

		giveaway.links = giveaway.innerWrap?.getElementsByClassName('giveaway__links')[0];
		if (giveaway.links) {
			giveaway.links.classList.add('esgst-giveaway-links');
			giveaway.entriesLink = giveaway.links.firstElementChild;
			giveaway.commentsLink = giveaway.entriesLink?.nextElementSibling;
		} else if (paths.giveaway) {
			const navCounts = mainContext.getElementsByClassName('sidebar__navigation__item__count');
			giveaway.entriesLink = navCounts[1];
			giveaway.commentsLink = navCounts[0];
		}

		if (giveaway.entriesLink && giveaway.commentsLink) {
			giveaway.entriesLink.setAttribute('data-draggable-id', 'entries');
			giveaway.commentsLink.setAttribute('data-draggable-id', 'comments');
			giveaway.entries = parseInt(giveaway.entriesLink.textContent.replace(/,/g, '').match(/\d+/)?.[0] || '0', 10);
			giveaway.comments = parseInt(giveaway.commentsLink.textContent.replace(/,/g, '').match(/\d+/)?.[0] || '0', 10);
		}

		if (!giveaway.entriesLink && !paths.won) {
			const entriesLink = giveaway.innerWrap?.querySelectorAll('.table__column--width-small')[paths.created ? 1 : 0];
			if (entriesLink) {
				giveaway.entriesLink = entriesLink;
				giveaway.entries = parseInt(entriesLink.textContent.replace(/,/g, ''), 10);
			}
		}

		DOM.insert(giveaway.summary, 'beforeend', <div ref={(ref) => (giveaway.extraPanel = ref)} />);
		giveaway.panel = giveaway.innerWrap?.getElementsByClassName('esgst-giveaway-panel')[0];

		const hasPanelSettings = ['gwc', 'gwr', 'gptw', 'gp', 'elgb', 'cewgd'].some((setting) => Settings.get(setting));

		if (!giveaway.panel && hasPanelSettings) {
			if (giveaway.links) {
				DOM.insert(
					giveaway.links,
					'afterend',
					<div className="esgst-panel-flexbox" ref={(ref) => (giveaway.panelFlexbox = ref)}></div>
				);
				giveaway.panelFlexbox.appendChild(giveaway.links);
				giveaway.panel = createElements(giveaway.panelFlexbox, 'beforeend', [
					{ attributes: { class: 'giveaway__columns esgst-giveaway-panel' }, type: 'div' },
				]);
			} else if (giveaway.columns) {
				const panelClass = paths.archive ? 'giveaway__columns esgst-giveaway-panel' : 'featured__columns esgst-giveaway-panel';
				if (paths.archive) giveaway.columns.style.justifyContent = 'flex-end';

				giveaway.panel = createElements(giveaway.columns, 'afterend', [
					{ attributes: { class: panelClass }, type: 'div' },
				]);
			} else if (
				(paths.entered || (paths.won && Settings.get('cewgd') && Settings.get('cewgd_w') && Settings.get('cewgd_w_e'))) &&
				(Settings.get('gwc') || Settings.get('gwr') || Settings.get('gptw'))
			) {
				giveaway.panel = createElements(
					giveaway.innerWrap.firstElementChild.nextElementSibling,
					'afterend',
					[{ attributes: { class: 'table__column--width-small text-center esgst-giveaway-panel' }, type: 'div' }]
				);
			}
		}

		if (giveaway.sgTools && !giveaway.panel?.getElementsByClassName('esgst-ge-sgt-button')[0]) {
			createElements(giveaway.panel, 'beforeend', [
				{
					attributes: {
						class: 'esgst-ge-sgt-button esgst-giveaway-column-button',
						'data-draggable-id': 'sgTools',
						href: `https://www.sgtools.info/giveaways/${giveaway.code}`,
						target: '_blank',
					},
					type: 'a',
					children: [{ attributes: { class: 'form__submit-button' }, text: 'SGTools', type: 'div' }],
				},
			]);
		}

		giveaway.elgbPanel = giveaway.panel;
		giveaway.levelColumn = giveaway.outerWrap.querySelector(
			'.giveaway__column--contributor-level, .featured__column--contributor-level'
		);
		giveaway.level = giveaway.levelColumn ? parseInt(giveaway.levelColumn.textContent.match(/\d+/)?.[0] || '0', 10) : 0;

		giveaway.inviteOnly = giveaway.outerWrap.querySelector('.giveaway__column--invite-only, .featured__column--invite-only');
		giveaway.regionRestricted = giveaway.outerWrap.querySelector(
			'.giveaway__column--region-restricted, .featured__column--region-restricted'
		);
		giveaway.group = giveaway.outerWrap.querySelector('.giveaway__column--group, .featured__column--group');
		giveaway.whitelist = giveaway.outerWrap.querySelector('.giveaway__column--whitelist, .featured__column--whitelist');
		giveaway.public = !giveaway.sgTools && !giveaway.inviteOnly && !giveaway.regionRestricted && !giveaway.group && !giveaway.whitelist;

		if (!main || !paths.giveaway) {
			const iconsToAttach = [
				{ el: giveaway.inviteOnly, iconClass: 'fa fa-lock' },
				{ el: giveaway.group, iconClass: 'fa fa-user' },
				{ el: giveaway.whitelist, iconClass: 'fa fa-heart' },
			];

			for (const { el, iconClass } of iconsToAttach) {
				if (el) {
					createElements(el, 'atinner', [{ attributes: { class: iconClass }, type: 'i' }]);
				}
			}
		}

		const chanceEl = context.getElementsByClassName('esgst-gwc')[0];
		giveaway.chance = chanceEl ? parseFloat(chanceEl.getAttribute('data-chance')) : 0;
		giveaway.projectedChance = chanceEl ? parseFloat(chanceEl.getAttribute('data-projectedChance')) : 0;
		giveaway.chancePerPoint = giveaway.chance / Math.max(1, giveaway.points);
		giveaway.projectedChancePerPoint = giveaway.projectedChance / Math.max(1, giveaway.points);

		giveaway.blacklist = giveaway.outerWrap.getAttribute('data-blacklist');
		giveaway.error = giveaway.outerWrap.getAttribute('data-error');

		const ratioEl = context.getElementsByClassName('esgst-gwr')[0];
		giveaway.ratio = ratioEl ? parseFloat(ratioEl.getAttribute('data-ratio')) : 0;
		giveaway.projectedRatio = ratioEl ? parseFloat(ratioEl.getAttribute('data-projectedRatio')) : 0;

		const pointsToWinEl = context.getElementsByClassName('esgst-gptw')[0];
		giveaway.pointsToWin = pointsToWinEl ? parseFloat(pointsToWinEl.getAttribute('data-pointsToWin')) : 0;

		giveaway.enterable = giveaway.outerWrap.getAttribute('data-enterable');
		giveaway.currentlyEnterable = giveaway.outerWrap.getAttribute('data-currently-enterable');

		if (main) {
			const canRecreate =
				Settings.get('gr') &&
				giveaway.creator === Settings.get('username') &&
				(Settings.get('gr_a') || (giveaway.ended && (giveaway.entries === 0 || giveaway.entries < giveaway.copies))) &&
				(!Settings.get('gr_r') || !this.esgst.giveaways[giveaway.code]?.recreated) &&
				!giveaway.heading?.getElementsByClassName('esgst-gr-button')[0];

			if (canRecreate) {
				const button = createElements(giveaway.headingName, 'beforebegin', [
					{
						attributes: {
							class: 'esgst-gr-button',
							'data-draggable-id': 'gr',
							title: `${getFeatureTooltip('gr', 'Recreate giveaway')}`,
						},
						type: 'div',
						children: [{ attributes: { class: 'fa fa-rotate-left' }, type: 'i' }],
					},
				]);

				button.firstElementChild.addEventListener(
					'click',
					this.esgst.modules.giveawaysGiveawayRecreator.gr_recreateGiveaway.bind(
						this.esgst.modules.giveawaysGiveawayRecreator,
						button,
						giveaway
					),
					true
				);
			}
		}

		let hideButton = giveaway.innerWrap?.querySelector('.giveaway__hide, .featured__giveaway__hide');
		if (hideButton && !hideButton.classList.contains('fa-eye')) {
			if (!main || endless) {
				if (hideButton.classList.contains('featured__giveaway__hide')) {
					hideButton = hideButton.parentElement;
				}
				const temp = hideButton.previousElementSibling;
				createElements(hideButton, 'atouter', [
					{
						attributes: {
							class: 'fa fa-eye-slash giveaway__hide giveaway__icon',
							title: getFeatureTooltip(null, 'Hide all giveaways for this game'),
						},
						type: 'i',
					},
				]);
				hideButton = temp.nextElementSibling;
				hideButton.addEventListener('click', hideGame.bind(common, hideButton, giveaway.gameId, giveaway.name, giveaway.id, giveaway.type));
			} else if (Settings.get('lastSyncHiddenGames') > 0) {
				hideButton.addEventListener('click', () => {
					this.esgst.hidingGame = { id: giveaway.id, type: giveaway.type };
				});
			}
		}

		if (hideButton) {
			const targetEl = hideButton.classList.contains('featured__giveaway__hide') ? hideButton.parentElement : hideButton;
			targetEl.setAttribute('data-draggable-id', 'hideGame');
		}

		if (giveaway.heading) {
			for (const child of giveaway.heading.children) {
				if (child === giveaway.headingName || child.classList.contains('giveaway__heading__name') || child.classList.contains('featured__heading__medium')) {
					child.setAttribute('data-draggable-id', 'name');
				} else if (/\(.+?\sCopies\)/.test(child.textContent)) {
					child.setAttribute('data-draggable-id', 'copies');
				} else if (/\(.+?P\)/.test(child.textContent)) {
					child.setAttribute('data-draggable-id', 'points');
				} else if (child.getAttribute('href')?.includes('store.steampowered.com')) {
					child.setAttribute('data-draggable-id', 'steam');
				} else if (child.matches('.giveaway__icon.fa-camera[data-lightbox-id]')) {
					child.setAttribute('data-draggable-id', 'screenshots-videos');
				} else if (child.getAttribute('href')?.includes('/giveaways/search')) {
					child.setAttribute('data-draggable-id', 'search');
				}
			}
		}

		giveaway.winnerColumns = {};
		giveaway.numWinners = Math.min(giveaway.entries || 0, giveaway.copies);

		if (giveaway.startTimeColumn && giveaway.endTimeColumn) {
			let column = giveaway.endTimeColumn.nextElementSibling;
			while (column && column !== giveaway.startTimeColumn) {
				let key = '';
				let status = '';

				if (column.classList.contains('giveaway__column--positive')) {
					[key, status] = ['received', 'Received'];
				} else if (column.classList.contains('giveaway__column--negative')) {
					[key, status] = ['notReceived', 'Not Received'];
				} else if (/Awaiting\sfeedback/.test(column.textContent.trim())) {
					[key, status] = ['awaitingFeedback', 'Awaiting Feedback'];
				} else if (/No\swinners/.test(column.textContent.trim())) {
					[key, status] = ['noWinners', ''];
				} else {
					column = column.nextElementSibling;
					continue;
				}

				const winners = [];
				if (key === 'received' || key === 'notReceived') {
					winners.push(...column.textContent.trim().split(/,\s/).filter(Boolean));
					giveaway.winners.push(...winners.map((x) => ({ status, username: x })));
					if (key === 'received') {
						giveaway.winnerNames = winners.map((x) => x.toLowerCase());
					}
				}

				giveaway.winnerColumns[key] = { column, status, winners };
				column.setAttribute('data-draggable-id', 'winners');
				column = column.nextElementSibling;
			}
		}

		if (!giveaway.winners.length || giveaway.numWinners < 4) {
			giveaway.numWinners = giveaway.winners.length;
		}

		const dragAttributes = [
			[giveaway.endTimeColumn, 'endTime'],
			[giveaway.startTimeColumn, 'startTime'],
			[giveaway.inviteOnly, 'inviteOnly'],
			[giveaway.whitelist, 'whitelist'],
			[giveaway.group, 'group'],
			[giveaway.regionRestricted, 'regionRestricted'],
			[giveaway.levelColumn, 'level'],
			[giveaway.sourceColumn, 'ged'],
		];

		for (const [element, id] of dragAttributes) {
			element?.setAttribute('data-draggable-id', id);
		}

		return {
			giveaway,
			data: {
				gameId: giveaway.gameId,
				gameSteamId: giveaway.id,
				gameType: giveaway.type,
				gameName: giveaway.name,
				code: giveaway.code,
				copies: giveaway.copies,
				points: giveaway.points,
				ended: giveaway.ended,
				endTime: giveaway.endTime,
				startTime: giveaway.startTime,
				started: giveaway.started,
				creator: giveaway.creator,
				winners: giveaway.numWinners > 3 ? [] : giveaway.winners,
				numWinners: giveaway.numWinners,
				entries: giveaway.entries,
				comments: giveaway.comments,
				level: giveaway.level,
				public: giveaway.public,
				inviteOnly: !!(giveaway.inviteOnly || giveaway.sgTools),
				regionRestricted: !!giveaway.regionRestricted,
				group: !!giveaway.group,
				whitelist: !!giveaway.whitelist,
				v: Shared.esgst.CURRENT_GIVEAWAY_VERSION,
			},
		};
	}

	giveaways_reorder(giveaway) {
		if (
			(giveaway.columns && !Shared.common.isGiveawayColumnsDefault) ||
			(giveaway.gvIcons && !Shared.common.isGiveawayColumnsGvDefault)
		) {
			for (const id of giveaway.gvIcons
				? Settings.get('giveawayColumns_gv')
				: Settings.get('giveawayColumns')) {
				if (id === 'startTime' && Shared.common.isCurrentPath('Archive')) {
					continue;
				}
				const elements = giveaway.outerWrap.querySelectorAll(`[data-draggable-id="${id}"]`);
				for (const element of elements) {
					try {
						const button = Button.create().parse(element);
						button.insert(giveaway.gvIcons || giveaway.columns, 'beforeend');
					} catch (err) {
						(giveaway.gvIcons || giveaway.columns).appendChild(element);
					}
					if (giveaway.elementOrdering) {
						continue;
					}
					if (element.getAttribute('data-draggable-id').match(/^(elgb|gp)$/)) {
						element.classList.add('esgst-giveaway-column-button');
					}
					if (
						!this.esgst.giveawayPath &&
						element
							.getAttribute('data-draggable-id')
							.match(/steam|screenshots-videos|search|hideGame/)
					) {
						element.classList.remove('giveaway__icon');
					}
					element.classList.add(this.esgst.giveawayPath ? 'featured__column' : 'giveaway__column');
					if (element.getAttribute('data-color')) {
						element.firstElementChild.style.color = element.getAttribute('data-bgColor');
						element.style.color = '';
						element.style.backgroundColor = '';
					}
				}
			}
			if (giveaway.columns && giveaway.avatar && giveaway.columns.contains(giveaway.avatar)) {
				giveaway.columns.appendChild(giveaway.avatar);
			}
		}
		if (
			giveaway.panel &&
			((!giveaway.gvIcons && !Shared.common.isGiveawayPanelDefault) ||
				(giveaway.gvIcons && !Shared.common.isGiveawayPanelGvDefault))
		) {
			for (const id of giveaway.gvIcons
				? Settings.get('giveawayPanel_gv')
				: Settings.get('giveawayPanel')) {
				const elements = giveaway.outerWrap.querySelectorAll(`[data-draggable-id="${id}"]`);
				for (const element of elements) {
					try {
						const button = Button.create().parse(element);
						button.insert(giveaway.panel, 'beforeend');
					} catch (err) {
						giveaway.panel.appendChild(element);
					}
					if (giveaway.elementOrdering) {
						continue;
					}
					if (element.getAttribute('data-draggable-id').match(/^(elgb|gp)$/)) {
						element.classList.remove(
							'esgst-giveaway-column-button',
							this.esgst.giveawayPath ? 'featured__column' : 'giveaway__column'
						);
					} else {
						element.classList.add(
							this.esgst.giveawayPath ? 'featured__column' : 'giveaway__column'
						);
					}
					if (
						!this.esgst.giveawayPath &&
						element
							.getAttribute('data-draggable-id')
							.match(/steam|screenshots-videos|search|hideGame/)
					) {
						element.classList.remove('giveaway__icon');
					}
					if (element.getAttribute('data-color')) {
						element.style.color = element.getAttribute('data-color');
						element.style.backgroundColor = element.getAttribute('data-bgColor');
					}
				}
			}
		}
		if (
			giveaway.heading &&
			((!giveaway.gvIcons && !Shared.common.isGiveawayHeadingDefault) ||
				(giveaway.gvIcons && !Shared.common.isGiveawayHeadingGvDefault))
		) {
			for (const id of giveaway.gvIcons
				? Settings.get('giveawayHeading_gv')
				: Settings.get('giveawayHeading')) {
				const elements = giveaway.outerWrap.querySelectorAll(`[data-draggable-id="${id}"]`);
				for (const element of elements) {
					try {
						const button = Button.create().parse(element);
						button.insert(giveaway.heading, 'beforeend');
					} catch (err) {
						giveaway.heading.appendChild(element);
					}
					if (giveaway.elementOrdering) {
						continue;
					}
					if (element.getAttribute('data-draggable-id').match(/^(elgb|gp)$/)) {
						element.classList.remove('esgst-giveaway-column-button');
					}
					if (
						!this.esgst.giveawayPath &&
						element
							.getAttribute('data-draggable-id')
							.match(/steam|screenshots-videos|search|hideGame/)
					) {
						element.classList.add('giveaway__icon');
					}
					element.classList.remove(
						this.esgst.giveawayPath ? 'featured__column' : 'giveaway__column'
					);
					if (element.getAttribute('data-color')) {
						element.style.color = element.getAttribute('data-color');
						element.style.backgroundColor = element.getAttribute('data-bgColor');
					}
				}
			}
		}
		if (
			giveaway.links &&
			((!giveaway.gvIcons && !Shared.common.isGiveawayLinksDefault) ||
				(giveaway.gvIcons && !Shared.common.isGiveawayLinksGvDefault))
		) {
			for (const id of giveaway.gvIcons
				? Settings.get('giveawayLinks_gv')
				: Settings.get('giveawayLinks')) {
				const elements = giveaway.outerWrap.querySelectorAll(`[data-draggable-id="${id}"]`);
				for (const element of elements) {
					try {
						const button = Button.create().parse(element);
						button.insert(giveaway.links, 'beforeend');
					} catch (err) {
						giveaway.links.appendChild(element);
					}
					if (giveaway.elementOrdering) {
						continue;
					}
					if (element.getAttribute('data-draggable-id').match(/^(elgb|gp)$/)) {
						element.classList.remove('esgst-giveaway-column-button');
					}
					if (
						!this.esgst.giveawayPath &&
						element
							.getAttribute('data-draggable-id')
							.match(/steam|screenshots-videos|search|hideGame/)
					) {
						element.classList.remove('giveaway__icon');
					}
					element.classList.remove(
						this.esgst.giveawayPath ? 'featured__column' : 'giveaway__column'
					);
					if (element.getAttribute('data-color')) {
						element.style.color = element.getAttribute('data-color');
						element.style.backgroundColor = element.getAttribute('data-bgColor');
					}
				}
			}
		}
		if (
			giveaway.extraPanel &&
			((!giveaway.gvIcons && !Shared.common.isGiveawayExtraPanelDefault) ||
				(giveaway.gvIcons && !Shared.common.isGiveawayExtraPanelGvDefault))
		) {
			for (const id of giveaway.gvIcons
				? Settings.get('giveawayExtraPanel_gv')
				: Settings.get('giveawayExtraPanel')) {
				const elements = giveaway.outerWrap.querySelectorAll(`[data-draggable-id="${id}"]`);
				for (const element of elements) {
					try {
						const button = Button.create().parse(element);
						button.insert(giveaway.extraPanel, 'beforeend');
					} catch (err) {
						giveaway.extraPanel.appendChild(element);
					}
					if (giveaway.elementOrdering) {
						continue;
					}
					if (element.getAttribute('data-draggable-id').match(/^(elgb|gp)$/)) {
						element.classList.remove('esgst-giveaway-column-button');
					}
					if (
						!this.esgst.giveawayPath &&
						element
							.getAttribute('data-draggable-id')
							.match(/steam|screenshots-videos|search|hideGame/)
					) {
						element.classList.remove('giveaway__icon');
					}
					element.classList.remove(
						this.esgst.giveawayPath ? 'featured__column' : 'giveaway__column'
					);
					if (element.getAttribute('data-color')) {
						element.style.color = element.getAttribute('data-color');
						element.style.backgroundColor = element.getAttribute('data-bgColor');
					}
				}
			}
		}
		if (giveaway.gcPanel) {
			for (const id of giveaway.gvIcons
				? Settings.get('gc_categories_gv')
				: Settings.get('gc_categories')) {
				const elements = giveaway.outerWrap.querySelectorAll(`[data-draggable-id="${id}"]`);
				for (const element of elements) {
					try {
						const button = Button.create().parse(element);
						button.insert(giveaway.gcPanel, 'beforeend');
					} catch (err) {
						giveaway.gcPanel.appendChild(element);
					}
					if (giveaway.elementOrdering) {
						continue;
					}
					if (element.getAttribute('data-draggable-id').match(/^(elgb|gp)$/)) {
						element.classList.remove('esgst-giveaway-column-button');
					}
					if (
						!this.esgst.giveawayPath &&
						element
							.getAttribute('data-draggable-id')
							.match(/steam|screenshots-videos|search|hideGame/)
					) {
						element.classList.remove('giveaway__icon');
					}
					element.classList.remove(
						this.esgst.giveawayPath ? 'featured__column' : 'giveaway__column'
					);
					if (element.getAttribute('data-color')) {
						element.style.color = element.getAttribute('data-color');
						element.style.backgroundColor = element.getAttribute('data-bgColor');
					}
				}
			}
			const loading = giveaway.gcPanel.querySelector('.esgst-gc-loading');
			if (loading) {
				giveaway.gcPanel.appendChild(loading);
			}
		}
	}
}

const giveawaysModule = new Giveaways();

export { giveawaysModule };
