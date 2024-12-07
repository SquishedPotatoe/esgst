import IntersectionObserver from 'intersection-observer-polyfill';
import { DOM } from '../../class/DOM';
import { EventDispatcher } from '../../class/EventDispatcher';
import { FetchRequest } from '../../class/FetchRequest';
import { Module } from '../../class/Module';
import { Scope } from '../../class/Scope';
import { Settings } from '../../class/Settings';
import { Shared } from '../../class/Shared';
import { NotificationBar } from '../../components/NotificationBar';
import { Events } from '../../constants/Events';
import { common } from '../Common';

const animateScroll = common.animateScroll.bind(common),
	checkMissingDiscussions = common.checkMissingDiscussions.bind(common),
	createElements = common.createElements.bind(common),
	createHeadingButton = common.createHeadingButton.bind(common),
	endless_load = common.endless_load.bind(common),
	reverseComments = common.reverseComments.bind(common),
	setSetting = common.setSetting.bind(common);
class GeneralEndlessScrolling extends Module {
	constructor() {
		super();
		this.info = {
			description: () => (
				<ul>
					<li>
						Loads the next page when you scroll down to the end of any page, allowing you to
						endlessly scroll through pages.
					</li>
					<li>Adds multiple buttons to the main page heading of the page:</li>
					<ul>
						<li>
							<i className="fa fa-play"></i> if the endless scrolling is paused and{' '}
							<i className="fa fa-pause"></i> if it is not, which allows you to pause/resume the
							endless scrolling.
						</li>
						<li>
							<i className="fa fa-step-forward"></i>, which allows you to load the next page without
							having to scroll down.
						</li>
						<li>
							<i className="fa fa-fast-forward"></i>, which allows you continuously load the next
							pages until either the last page is reached or you pause the endless scrolling.
						</li>
						<li>
							<i className="fa fa-refresh"></i> <i className="fa fa-map-marker"></i>, which allows
							you to refresh the page currently visible in the window.
						</li>
						<li>
							<i className="fa fa-refresh"></i>, which allows you to refresh all of the pages that
							have been loaded.
						</li>
					</ul>
					<li>
						You can choose whether or not to show page dividers (page headings separating each
						loaded page).
					</li>
					<li>
						As you scroll through the page, the pagination navigation of the page changes according
						to the page currently visible in the window.
					</li>
					<li>
						If you use the pagination navigation of the page to try to go to a page that has been
						loaded, it scrolls to the page instead of opening it.
					</li>
					<li>
						There is a reverse scrolling option for discussions that loads the pages in descending
						order and loads the last page instead of the first one when visiting a discussion from
						the main/inbox page.
					</li>
				</ul>
			),
			features: {
				es_murl: {
					name: "Modify URL when changing pages to reflect the current page that you're on.",
					sg: true,
					st: true,
				},
				es_ch: {
					name: 'Enable for Comment History.',
					sg: true,
				},
				es_df: {
					name: 'Enable for Discussion Filters.',
					sg: true,
				},
				es_tf: {
					name: 'Enable for Trade Filters.',
					st: true,
				},
				es_gb: {
					name: 'Enable for Giveaway Bookmarks.',
					sg: true,
				},
				es_ged: {
					name: 'Enable for Giveaway Encrypter/Decrypter.',
					sg: true,
				},
				es_ge: {
					name: 'Enable for Giveaway Extractor.',
					sg: true,
				},
				es_gf: {
					name: 'Enable for Giveaway Filters.',
					sg: true,
				},
				es_cl: {
					inputItems: [
						{
							attributes: {
								max: 10,
								min: 0,
								type: 'number',
							},
							id: 'es_pages',
							prefix: `Pages (Max 10): `,
						},
					],
					name: 'Continuously load X more pages automatically when visiting any page.',
					sg: true,
				},
				es_r: {
					description: () => (
						<ul>
							<li>Loads the pages of a discussion in descending order.</li>
							<li>
								Loads the last page instead of the first one when visiting a discussion from the
								main/inbox page.
							</li>
						</ul>
					),
					name: 'Enable reverse scrolling.',
					sg: true,
				},
				es_rd: {
					name: 'Refresh active discussions/deals when refreshing the main page.',
					sg: true,
				},
				es_pd: {
					description: () => (
						<ul>
							<li>
								With this option enabled, each loaded page is separated by a page heading, which
								makes it very clear where a page ends and another begins. With it disabled, there is
								no such distinction, so it looks like the entire page is a single page, giving a
								true endless feeling.
							</li>
						</ul>
					),
					name: 'Show page dividers.',
					sg: true,
					st: true,
				},
			},
			id: 'es',
			name: 'Endless Scrolling',
			sg: true,
			st: true,
			includeOptions: [
				{
					id: 'pause',
					name: 'Paused',
				},
			],
			type: 'general',
		};
	}

	async init() {
		if (!this.esgst.mainPageHeading || !this.esgst.pagination) return;
		if (this.esgst.pagination.classList.contains('pagination--no-results')) {
			this.esgst.itemsPerPage = 50;
		} else {
			this.esgst.itemsPerPage =
				parseInt(
					this.esgst.pagination.firstElementChild.firstElementChild.nextElementSibling.textContent.replace(
						/,/g,
						''
					)
				) -
				parseInt(
					this.esgst.pagination.firstElementChild.firstElementChild.textContent.replace(/,/g, '')
				) +
				1;
		}
		let es = {};
		this.esgst.es = es;
		es.dividers = Settings.get('es_pd');
		es.mainContext = this.esgst.pagination.previousElementSibling;
		if (this.esgst.commentsPath && !es.mainContext.classList.contains('comments')) {
			DOM.insert(
				es.mainContext,
				'afterend',
				<div className="comments" ref={(ref) => (es.mainContext = ref)}></div>
			);
		}
		let rows = es.mainContext.getElementsByClassName('table__rows')[0];
		if (rows) {
			es.mainContext = rows;
		}
		es.paginations = [
			this.esgst.paginationNavigation ? this.esgst.paginationNavigation.innerHTML : '',
		];
		es.reverseScrolling = Settings.get('es_r') && this.esgst.discussionPath;
		if (es.reverseScrolling) {
			if (
				this.esgst.currentPage === 1 &&
				this.esgst.paginationNavigation &&
				!this.esgst.parameters.page
			) {
				for (let i = 0, n = es.mainContext.children.length; i < n; ++i) {
					es.mainContext.children[0].remove();
				}
				Scope.find('main')?.resetData('comments');
				this.esgst.pagination.firstElementChild.firstElementChild.nextElementSibling.textContent =
					'0';
				let lastLink = this.esgst.paginationNavigation.lastElementChild;
				if (
					lastLink.classList.contains('is-selected') &&
					lastLink.querySelector('.fa-angle-double-right') &&
					!this.esgst.lastPageLink
				) {
					es.currentPage = parseInt(lastLink.getAttribute('data-page-number'));
				} else {
					let LastPage = (await FetchRequest.get(`${this.esgst.searchUrl}last`)).html;
					this.esgst.pagination.firstElementChild.firstElementChild.textContent = LastPage.body.getElementsByClassName('pagination__results')[0].firstElementChild.innerHTML;
					this.esgst.pagination.firstElementChild.firstElementChild.nextElementSibling.textContent = LastPage.body.getElementsByClassName('pagination__results')[0].firstElementChild.nextElementSibling.innerHTML;
					es.currentPage = Math.ceil(
						parseInt(this.esgst.pagination.firstElementChild.firstElementChild.textContent.replace(/,/g, '')) /
						25
					);
					es.pageBase = es.currentPage + 1;
				}
				es.nextPage = es.currentPage;
				es.reversePages = true;
				es.ended = false;
			} else {
				es.currentPage = this.esgst.currentPage;
				es.nextPage = es.currentPage - 1;
				es.pageBase = es.currentPage + 1;
				es.ended = es.nextPage === 0;
			}
		} else {
			es.currentPage = this.esgst.currentPage;
			es.nextPage = es.currentPage + 1;
			es.pageBase = es.currentPage - 1;
			es.ended =
				!this.esgst.paginationNavigation ||
				this.esgst.paginationNavigation.lastElementChild.classList.contains(
					this.esgst.selectedClass
				);
		}
		const options = {
			rootMargin: `-${this.esgst.commentsTop + 1}px 0px 0px 0px`,
		};
		es.observer = new IntersectionObserver(this.es_observe.bind(this, es), options);
		// noinspection JSIgnoredPromiseFromCall
		this.es_activate(es);

		if (window.location.href.includes('happy-holidays')) {
			const boxList = document.querySelector(".giveaway_box_list");
			var holidayBoxes = new MutationObserver(function () {
				$('.giveaway_box').each(function () {
					var elem = $(this);
					var background_default = 'repeating-linear-gradient(45deg, rgba(232, 234, 237, 0.95), rgba(232, 234, 237, 0.95) 15px, rgba(239, 241, 245, 0.95) 15px, rgba(239, 241, 245, 0.95) 30px)';
					var color_default = 'transparent';
					// Dimensions
					var base_width = parseInt(elem.data('base-width'));
					var base_height = parseInt(elem.data('base-height'));
					var base_depth = parseInt(elem.data('base-depth'));
					var cover_height = parseInt(elem.data('cover-height'));
					// Base
					var base_front = giveaway_box_validate_background_image(elem.data('base-front')) ? 'url(' + elem.data('base-front') + ')' : background_default;
					var base_back = giveaway_box_validate_background_image(elem.data('base-back')) ? 'url(' + elem.data('base-back') + ')' : background_default;
					var base_left = giveaway_box_validate_background_image(elem.data('base-left')) ? 'url(' + elem.data('base-left') + ')' : background_default;
					var base_right = giveaway_box_validate_background_image(elem.data('base-right')) ? 'url(' + elem.data('base-right') + ')' : background_default;
					var base_bottom = giveaway_box_validate_background_image(elem.data('base-bottom')) ? 'url(' + elem.data('base-bottom') + ')' : background_default;
					// Cover
					var cover_front = giveaway_box_validate_background_image(elem.data('cover-front')) ? 'url(' + elem.data('cover-front') + ')' : background_default;
					var cover_back = giveaway_box_validate_background_image(elem.data('cover-back')) ? 'url(' + elem.data('cover-back') + ')' : background_default;
					var cover_left = giveaway_box_validate_background_image(elem.data('cover-left')) ? 'url(' + elem.data('cover-left') + ')' : background_default;
					var cover_right = giveaway_box_validate_background_image(elem.data('cover-right')) ? 'url(' + elem.data('cover-right') + ')' : background_default;
					var cover_top = giveaway_box_validate_background_image(elem.data('cover-top')) ? 'url(' + elem.data('cover-top') + ')' : background_default;

					elem.find('.giveaway_box_cover > .front').css({ 'background-image': 'linear-gradient(rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.13) 100%)' + (giveaway_box_validate_background_image(elem.data('cover-front')) ? ', url(' + elem.data('cover-front') + ')' : (giveaway_box_validate_background_color(elem.data('cover-front')) ? '' : ', ' + background_default)) });
					elem.find('.giveaway_box_cover > .front').css({ 'background-color': giveaway_box_validate_background_color(elem.data('cover-front')) ? elem.data('cover-front') : color_default });
					elem.find('.giveaway_box_cover > .front').css({ 'width': (base_width + 10) + 'px', 'height': (cover_height) + 'px', 'transform': 'translateY(-' + Math.round((base_height / 2) - (cover_height / 2) + 2) + 'px) translateZ(' + (Math.round(base_depth / 2) + 5) + 'px)' });

					elem.find('.giveaway_box_cover > .back').css({ 'background-image': 'linear-gradient(rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.13) 100%)' + (giveaway_box_validate_background_image(elem.data('cover-back')) ? ', url(' + elem.data('cover-back') + ')' : (giveaway_box_validate_background_color(elem.data('cover-back')) ? '' : ', ' + background_default)) });
					elem.find('.giveaway_box_cover > .back').css({ 'background-color': giveaway_box_validate_background_color(elem.data('cover-back')) ? elem.data('cover-back') : color_default });
					elem.find('.giveaway_box_cover > .back').css({ 'width': (base_width + 10) + 'px', 'height': (cover_height) + 'px', 'transform': 'translateY(-' + Math.round((base_height / 2) - (cover_height / 2) + 2) + 'px) translateZ(-' + (Math.round(base_depth / 2) + 5) + 'px) rotateX(180deg) rotateZ(-180deg)' });

					elem.find('.giveaway_box_cover > .left').css({ 'background-image': 'linear-gradient(rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.13) 100%)' + (giveaway_box_validate_background_image(elem.data('cover-left')) ? ', url(' + elem.data('cover-left') + ')' : (giveaway_box_validate_background_color(elem.data('cover-left')) ? '' : ', ' + background_default)) });
					elem.find('.giveaway_box_cover > .left').css({ 'background-color': giveaway_box_validate_background_color(elem.data('cover-left')) ? elem.data('cover-left') : color_default });
					elem.find('.giveaway_box_cover > .left').css({ 'width': (base_depth + 10) + 'px', 'height': (cover_height) + 'px', 'transform': 'translateY(-' + Math.round((base_height / 2) - (cover_height / 2) + 2) + 'px) translateX(-' + (Math.round(base_width / 2) + 5) + 'px) rotateY(-90deg)' });

					elem.find('.giveaway_box_cover > .right').css({ 'background-image': 'linear-gradient(rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.13) 100%)' + (giveaway_box_validate_background_image(elem.data('cover-right')) ? ', url(' + elem.data('cover-right') + ')' : (giveaway_box_validate_background_color(elem.data('cover-right')) ? '' : ', ' + background_default)) });
					elem.find('.giveaway_box_cover > .right').css({ 'background-color': giveaway_box_validate_background_color(elem.data('cover-right')) ? elem.data('cover-right') : color_default });
					elem.find('.giveaway_box_cover > .right').css({ 'width': (base_depth + 10) + 'px', 'height': (cover_height) + 'px', 'transform': 'translateY(-' + Math.round((base_height / 2) - (cover_height / 2) + 2) + 'px) translateX(' + (Math.round(base_width / 2) + 5) + 'px) rotateY(90deg)' });

					elem.find('.giveaway_box_cover > .top').css({ 'background-image': giveaway_box_validate_background_image(elem.data('cover-top')) ? 'url(' + elem.data('cover-top') + ')' : (giveaway_box_validate_background_color(elem.data('cover-top')) ? '' : background_default) });
					elem.find('.giveaway_box_cover > .top').css({ 'background-color': giveaway_box_validate_background_color(elem.data('cover-top')) ? elem.data('cover-top') : color_default });
					elem.find('.giveaway_box_cover > .top').css({ 'width': (base_width + 10) + 'px', 'height': (base_depth + 10) + 'px', 'transform': 'translateY(-' + (Math.round(base_height / 2) + 2) + 'px) rotateX(90deg)' });

					elem.find('.giveaway_box_base > .front').css({ 'background-image': 'linear-gradient(rgba(0, 0, 0, 0) ' + Math.round((cover_height + 9)) + 'px, rgba(0, 0, 0, 0.18) 100%)' + (giveaway_box_validate_background_image(elem.data('base-front')) ? ', url(' + elem.data('base-front') + ')' : (giveaway_box_validate_background_color(elem.data('base-front')) ? '' : ', ' + background_default)) });
					elem.find('.giveaway_box_base > .front').css({ 'background-color': giveaway_box_validate_background_color(elem.data('base-front')) ? elem.data('base-front') : color_default });
					elem.find('.giveaway_box_base > .front').css({ 'width': base_width + 'px', 'height': base_height + 'px', 'transform': 'translateZ(' + Math.round(base_depth / 2) + 'px)' });

					elem.find('.giveaway_box_base > .back').css({ 'background-image': 'linear-gradient(rgba(0, 0, 0, 0) ' + Math.round((cover_height + 9)) + 'px, rgba(0, 0, 0, 0.18) 100%)' + (giveaway_box_validate_background_image(elem.data('base-back')) ? ', url(' + elem.data('base-back') + ')' : (giveaway_box_validate_background_color(elem.data('base-back')) ? '' : ', ' + background_default)) });
					elem.find('.giveaway_box_base > .back').css({ 'background-color': giveaway_box_validate_background_color(elem.data('base-back')) ? elem.data('base-back') : color_default });
					elem.find('.giveaway_box_base > .back').css({ 'width': base_width + 'px', 'height': base_height + 'px', 'transform': 'translateZ(-' + Math.round(base_depth / 2) + 'px) rotateX(180deg) rotateZ(-180deg)' });

					elem.find('.giveaway_box_base > .left').css({ 'background-image': 'linear-gradient(rgba(0, 0, 0, 0) ' + Math.round((cover_height + 9)) + 'px, rgba(0, 0, 0, 0.18) 100%)' + (giveaway_box_validate_background_image(elem.data('base-left')) ? ', url(' + elem.data('base-left') + ')' : (giveaway_box_validate_background_color(elem.data('base-left')) ? '' : ', ' + background_default)) });
					elem.find('.giveaway_box_base > .left').css({ 'background-color': giveaway_box_validate_background_color(elem.data('base-left')) ? elem.data('base-left') : color_default });
					elem.find('.giveaway_box_base > .left').css({ 'width': base_depth + 'px', 'height': base_height + 'px', 'transform': 'translateX(-' + Math.round(base_width / 2) + 'px) rotateY(-90deg)' });

					elem.find('.giveaway_box_base > .right').css({ 'background-image': 'linear-gradient(rgba(0, 0, 0, 0) ' + Math.round((cover_height + 9)) + 'px, rgba(0, 0, 0, 0.18) 100%)' + (giveaway_box_validate_background_image(elem.data('base-right')) ? ', url(' + elem.data('base-right') + ')' : (giveaway_box_validate_background_color(elem.data('base-right')) ? '' : ', ' + background_default)) });
					elem.find('.giveaway_box_base > .right').css({ 'background-color': giveaway_box_validate_background_color(elem.data('base-right')) ? elem.data('base-right') : color_default });
					elem.find('.giveaway_box_base > .right').css({ 'width': base_depth + 'px', 'height': base_height + 'px', 'transform': 'translateX(' + Math.round(base_width / 2) + 'px) rotateY(90deg)' });

					elem.find('.giveaway_box_base > .bottom').css({ 'background-image': 'linear-gradient(rgba(0, 0, 0, 0.18), rgba(0, 0, 0, 0.18))' + (giveaway_box_validate_background_image(elem.data('base-bottom')) ? ', url(' + elem.data('base-bottom') + ')' : (giveaway_box_validate_background_color(elem.data('base-bottom')) ? '' : ', ' + background_default)) });
					elem.find('.giveaway_box_base > .bottom').css({ 'background-color': giveaway_box_validate_background_color(elem.data('base-bottom')) ? elem.data('base-bottom') : color_default });
					elem.find('.giveaway_box_base > .bottom').css({ 'width': base_width + 'px', 'height': base_depth + 'px', 'transform': 'translateY(' + Math.round(base_height / 2) + 'px) rotateX(90deg)' });

					elem.find('.giveaway_box_shadow > div').css({ 'width': base_width + 'px', 'height': base_depth + 'px', 'transform': 'translateY(' + Math.round(base_height / 2) + 'px) rotateX(-90deg)' });
				});
				function giveaway_box_validate_background_color(val) {
					return val.match(/^rgba\(([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5]),([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5]),([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5]),(1(\.[0]{1,2})?|(0)(\.[0-9]{1,2})?)\)$/i);
				}
				function giveaway_box_validate_background_image(val) {
					return val.match(/^(http|https):\/\/i\.imgur\.com\/([A-Za-z0-9]{5,8})\.(jpeg|jpg|png|gif)$/i);
				}
			});
			holidayBoxes.observe(boxList, { childList: true });
		}
	}

	es_observe(es, entries) {
		for (const entry of entries) {
			if (!entry.boundingClientRect || !entry.rootBounds) {
				continue;
			}
			if (!entry.target.getAttribute('data-esgst-intersection')) {
				// So it doesn't get fired when starting to observe an element.
				entry.target.setAttribute('data-esgst-intersection', true);
				if (!entry.isIntersecting) {
					continue;
				}
			}

			if (entry.target.classList.contains('pagination')) {
				if (entry.isIntersecting) {
					this.esgst.pagination.setAttribute('data-esgst-intersecting', 'true');
					this.esgst.es_loadNext(null, true);
				} else {
					this.esgst.pagination.removeAttribute('data-esgst-intersecting');
				}
			} else {
				const index = parseInt(entry.target.className.match(/es-page-(\d+)/)[1]);
				if (entry.isIntersecting) {
					this.es_changePagination(es, index);
				} else if (entry.boundingClientRect.y <= entry.rootBounds.y) {
					// The intersection element is no longer visible, but was scrolled upwards,
					// so we can now change the pagination.
					this.es_changePagination(es, es.reverseScrolling ? index - 1 : index + 1);
				}
			}
		}
	}

	async es_activate(es) {
		for (let i = 0, n = es.mainContext.children.length; i < n; ++i) {
			if (i === n - 1) {
				es.observer.observe(es.mainContext.children[i]);
			}
			es.mainContext.children[i].classList.add(`esgst-es-page-${es.currentPage}`);
		}
		es.nextButton = createHeadingButton({
			featureId: 'es',
			id: 'esNext',
			icons: ['fa-step-forward'],
			title: 'Load next page',
		});
		es.continuousButton = createHeadingButton({
			featureId: 'es',
			id: 'esContinuous',
			icons: ['fa-fast-forward'],
			title: 'Continuously load pages',
		});
		if (es.ended) {
			es.continuousButton.classList.add('esgst-hidden');
		}
		es.pauseButton = createHeadingButton({
			featureId: 'es',
			id: 'esPause',
			icons: ['fa-pause'],
			title: 'Pause the endless scrolling',
		});
		es.resumeButton = createHeadingButton({
			featureId: 'es',
			id: 'esResume',
			orderId: 'esPause',
			icons: ['fa-play'],
			title: 'Resume the endless scrolling',
		});
		es.refreshButton = createHeadingButton({
			featureId: 'es',
			id: 'esRefresh',
			icons: ['fa-refresh', 'fa-map-marker'],
			title: 'Refresh current page',
		});
		es.refreshAllButton = createHeadingButton({
			featureId: 'es',
			id: 'esRefreshAll',
			icons: ['fa-refresh'],
			title: 'Refresh all pages',
		});
		this.esgst.es_refresh = this.es_refresh.bind(this, es);
		es.refreshButton.addEventListener('click', this.esgst.es_refresh.bind(this));
		this.esgst.es_refreshAll = this.es_refreshAll.bind(this, es);
		es.refreshAllButton.addEventListener('click', this.esgst.es_refreshAll.bind(this));
		es.continuousButton.addEventListener('click', this.es_continuouslyLoad.bind(this, es));
		es.nextButton.addEventListener('click', this.es_stepNext.bind(this, es));
		es.pauseButton.addEventListener('click', this.es_pause.bind(this, es, false));
		es.resumeButton.addEventListener('click', this.es_resume.bind(this, es, false));
		if (this.esgst.paginationNavigation) {
			this.esgst.modules.generalPaginationNavigationOnTop.pnot_simplify();
			this.es_fixFirstPageLinks();
			let lastLink = this.esgst.paginationNavigation.lastElementChild;
			if (
				this.esgst.lastPageLink &&
				this.esgst.lastPage !== es.pageIndex &&
				!lastLink.classList.contains('is-selected') &&
				!lastLink.querySelector('.fa-angle-double-right')
			) {
				createElements(this.esgst.paginationNavigation, 'beforeend', this.esgst.lastPageLink);
			}
			this.es_setPagination(es);
		}
		es.isLimited = false;
		es.limitCount = 0;
		es.busy = false;
		es.paused =
			Settings.get('es') && Settings.get('es').options && Settings.get('es').options.pause;
		this.esgst.es_loadNext = this.es_loadNext.bind(this, es);
		if (es.paused) {
			// noinspection JSIgnoredPromiseFromCall
			this.es_pause(es, true);
		} else {
			// noinspection JSIgnoredPromiseFromCall
			this.es_resume(es, true);
		}
		es.pageIndex = es.currentPage;
		const options = {
			rootMargin: `0px 0px ${window.innerHeight}px 0px`,
		};
		const observer = new IntersectionObserver(this.es_observe.bind(this, es), options);
		observer.observe(this.esgst.pagination);
		if (es.paused && es.reversePages) {
			this.esgst.es_loadNext();
		} else if (Settings.get('es_cl')) {
			// noinspection JSIgnoredPromiseFromCall
			this.es_continuouslyLoad(es);
		}
		common.moveAdsDown(es);
	}

	async es_loadNext(es, callback, force) {
		if (
			!this.esgst.pagination.classList.contains('pagination--no-results') &&
			!this.esgst.stopEs &&
			!es.busy &&
			(!es.paused || es.reversePages) &&
			!es.ended &&
			((force && !es.continuous && !es.step) || (!force && (es.continuous || es.step))) &&
			(!es.isLimited || es.limitCount > 0)
		) {
			es.limitCount -= 1;
			es.busy = true;
			if (!es.progressBar) {
				es.progressBar = NotificationBar.create().build().setLoading('Loading next page...');
			}
			es.progressBar.insert(this.esgst.pagination, 'afterend').show();
			// noinspection JSIgnoredPromiseFromCall
			this.es_getNext(
				es,
				false,
				false,
				callback,
				await FetchRequest.get(`${this.esgst.searchUrl}${es.nextPage}`)
			);
		} else if (callback && typeof callback === 'function') {
			callback();
		}
	}

	async es_getNext(es, refresh, refreshAll, callback, response) {
		let pagination = response.html.getElementsByClassName('pagination')[0],
			context = pagination.previousElementSibling,
			rows = context.getElementsByClassName('table__rows')[0];
		if (this.esgst.commentsPath && !context.classList.contains('comments')) {
			if (!refreshAll) {
				es.refreshButton.addEventListener('click', this.esgst.es_refresh.bind(this));
				createElements(es.refreshButton, 'atinner', [
					{
						attributes: {
							class: 'fa fa-refresh',
						},
						type: 'i',
					},
					{
						attributes: {
							class: 'fa fa-map-marker',
						},
						type: 'i',
					},
				]);
			}
			return;
		}
		if (rows) {
			context = rows;
		}
		let paginationNavigation = pagination.getElementsByClassName(
			this.esgst.paginationNavigationClass
		)[0];
		if (es.reversePages) {
			es.paginations[0] = paginationNavigation.innerHTML;
			createElements(this.esgst.paginationNavigation, 'atinner', [
				...Array.from(DOM.parse(es.paginations[0]).body.childNodes).map((x) => {
					return {
						context: x,
					};
				}),
			]);
			if (this.esgst.paginationNavigation) {
				this.esgst.modules.generalPaginationNavigationOnTop.pnot_simplify();
				this.es_fixFirstPageLinks();
				let lastLink = this.esgst.paginationNavigation.lastElementChild;
				if (
					this.esgst.lastPageLink &&
					this.esgst.lastPage !== es.pageIndex &&
					!lastLink.classList.contains('is-selected') &&
					!lastLink.querySelector('.fa-angle-double-right')
				) {
					createElements(this.esgst.paginationNavigation, 'beforeend', this.esgst.lastPageLink);
				}
				this.es_setPagination(es);
			}
			es.reversePages = false;
			if (Settings.get('es_murl')) {
				this.updateUrl(es.currentPage);
			}
			this.esgst.pagination.firstElementChild.firstElementChild.textContent = (
				parseInt(
					this.esgst.pagination.firstElementChild.firstElementChild.nextElementSibling.textContent.replace(
						/,/g,
						''
					)
				) + 1
			)
				.toString()
				.replace(/\B(?=(\d{3})+(?!\d))/g, `,`);
			this.esgst.pagination.firstElementChild.firstElementChild.textContent = this.esgst.pagination.firstElementChild.firstElementChild.nextElementSibling.textContent;
		} else if (refresh) {
			pagination =
				es.paginations[
					(es.reverseScrolling
						? es.pageBase - (refreshAll || es.pageIndex)
						: (refreshAll || es.pageIndex) - es.pageBase) - 1
				];
			if (paginationNavigation && pagination !== paginationNavigation.innerHTML) {
				es.paginations[
					(es.reverseScrolling
						? es.pageBase - (refreshAll || es.pageIndex)
						: (refreshAll || es.pageIndex) - es.pageBase) - 1
				] = paginationNavigation.innerHTML;
				es.ended = false;
			}
		} else {
			es.paginations.push(paginationNavigation.innerHTML);
		}
		let fragment = document.createDocumentFragment();
		if (Settings.get('cr') && this.esgst.discussionPath) {
			reverseComments(context);
		}
		let n = context.children.length;
		const currentPage = refresh ? refreshAll || es.pageIndex : es.nextPage;
		for (let i = 0; i < n; ++i) {
			let child = context.children[0];
			child.classList.add(`esgst-es-page-${currentPage}`);
			fragment.appendChild(child);
		}
		let oldN = 0;
		if (refresh) {
			let elements = document.getElementsByClassName(`esgst-es-page-${currentPage}`);
			oldN = elements.length;
			for (let i = 1; i < oldN; ++i) {
				elements[0].remove();
			}
			let element = elements[0];
			if (element) {
				es.mainContext.insertBefore(fragment, element);
				es.observer.observe(element.previousElementSibling);
				element.remove();
			} else {
				es.mainContext.appendChild(fragment);
				es.observer.observe(es.mainContext.lastElementChild);
			}
			if (!refreshAll) {
				common.moveAdsDown(es);
				await endless_load(es.mainContext, true, null, currentPage);
				this.es_setRemoveEntry(es.mainContext);
				if (Settings.get('ts') && !Settings.get('us')) {
					this.esgst.modules.generalTableSorter.ts_sortTables();
				}
				es.refreshButton.addEventListener('click', this.esgst.es_refresh.bind(this));
				createElements(es.refreshButton, 'atinner', [
					{
						attributes: {
							class: 'fa fa-refresh',
						},
						type: 'i',
					},
					{
						attributes: {
							class: 'fa fa-map-marker',
						},
						type: 'i',
					},
				]);
			}
		} else {
			if (es.dividers) {
				createElements(es.mainContext, 'beforeend', [
					{
						attributes: {
							class: 'esgst-page-heading esgst-es-page-divider',
						},
						type: 'div',
						children: [
							{
								attributes: {
									class: 'page__heading__breadcrumbs page_heading_breadcrumbs',
								},
								type: 'div',
								children: [
									{
										attributes: {
											href: `${this.esgst.searchUrl}${es.nextPage}`,
										},
										text: `Page ${es.nextPage}`,
										type: 'a',
									},
								],
							},
						],
					},
				]);
			}
			es.mainContext.appendChild(fragment);
			es.observer.observe(es.mainContext.lastElementChild);
			common.moveAdsDown(es);
			await endless_load(es.mainContext, true, null, currentPage);
			this.es_setRemoveEntry(es.mainContext);
			if (Settings.get('ts') && !Settings.get('us')) {
				this.esgst.modules.generalTableSorter.ts_sortTables();
			}
			es.progressBar.hide();
			if (es.reverseScrolling) {
				--es.nextPage;
				es.busy = false;
				if (es.nextPage <= 0) {
					es.ended = true;
					if (callback && typeof callback === 'function') {
						callback();
					}
				} else if (!es.paused && !es.step) {
					if (es.continuous) {
						this.esgst.es_loadNext(callback);
					} else if (callback && typeof callback === 'function') {
						callback();
					} else if (this.esgst.pagination.getAttribute('data-esgst-intersecting')) {
						this.esgst.es_loadNext(null, true);
					}
				} else if (callback && typeof callback === 'function') {
					callback();
				}
			} else {
				++es.nextPage;
				es.busy = false;
				if (paginationNavigation.lastElementChild.classList.contains(this.esgst.selectedClass)) {
					es.ended = true;
					if (callback && typeof callback === 'function') {
						callback();
					}
				} else if (!es.paused && !es.step) {
					if (es.continuous) {
						this.esgst.es_loadNext(callback);
					} else if (callback && typeof callback === 'function') {
						callback();
					} else if (this.esgst.pagination.getAttribute('data-esgst-intersecting')) {
						this.esgst.es_loadNext(null, true);
					}
				} else if (callback && typeof callback === 'function') {
					callback();
				}
			}
		}
		let paginationCount = null;
		if (this.esgst.pagination.textContent.match(/No\sresults\swere\sfound\./)) {
			this.esgst.pagination.firstElementChild.firstChild.remove();
			DOM.insert(
				this.esgst.pagination.firstElementChild,
				'afterbegin',
				<fragment>
					Displaying <strong>1</strong> to <strong>{n}</strong> of <strong>{n}</strong>
					{` result${n > 1 ? 's' : ''}`}
				</fragment>
			);
		} else {
			if (es.reverseScrolling && !refresh) {
				paginationCount = this.esgst.pagination.firstElementChild.firstElementChild;
			} else {
				paginationCount = this.esgst.pagination.firstElementChild.firstElementChild
					.nextElementSibling;
			}
			paginationCount.textContent = (
				parseInt(paginationCount.textContent.replace(/,/g, '')) -
				oldN +
				(es.reverseScrolling && !refresh ? -n : n)
			)
				.toString()
				.replace(/\B(?=(\d{3})+(?!\d))/g, `,`);
		}
	}

	es_changePagination(es, index) {
		const correctedIndex = es.reverseScrolling ? es.pageBase - index : index - es.pageBase;
		const pagination = es.paginations[correctedIndex - 1];
		if (pagination && this.esgst.paginationNavigation.innerHTML !== pagination) {
			createElements(this.esgst.paginationNavigation, 'atinner', [
				...Array.from(DOM.parse(pagination).body.childNodes).map((x) => {
					return {
						context: x,
					};
				}),
			]);
			this.esgst.modules.generalPaginationNavigationOnTop.pnot_simplify();
			this.es_fixFirstPageLinks();
			let lastLink = this.esgst.paginationNavigation.lastElementChild;
			if (
				this.esgst.lastPageLink &&
				this.esgst.lastPage !== es.pageIndex &&
				!lastLink.classList.contains('is-selected') &&
				!lastLink.querySelector('.fa-angle-double-right')
			) {
				createElements(this.esgst.paginationNavigation, 'beforeend', this.esgst.lastPageLink);
			}
			this.es_setPagination(es);
			if (Settings.get('es_murl')) {
				this.updateUrl(index);
			}
		}
	}

	es_fixFirstPageLinks() {
		const firstPageLinks = this.esgst.paginationNavigation.querySelectorAll(
			`[data-page-number="1"]`
		);
		// @ts-ignore
		for (const firstPageLink of firstPageLinks) {
			firstPageLink.setAttribute('href', `${firstPageLink.getAttribute('href')}/search?page=1`);
		}
	}

	async es_stepNext(es) {
		if (es.step) return;
		createElements(es.nextButton, 'atinner', [
			{
				attributes: {
					class: 'fa fa-circle-o-notch fa-spin',
				},
				type: 'i',
			},
		]);
		es.step = true;
		const wasPaused = es.paused;
		await this.es_resume(es);
		this.esgst.es_loadNext(async () => {
			es.step = false;
			if (wasPaused) {
				await this.es_pause(es);
			} else {
				await this.es_resume(es);
			}
			createElements(es.nextButton, 'atinner', [
				{
					attributes: {
						class: 'fa fa-step-forward',
					},
					type: 'i',
				},
			]);
		});
	}

	async es_continuouslyLoad(es) {
		if (es.continuous) return;
		createElements(es.continuousButton, 'atinner', [
			{
				attributes: {
					class: 'fa fa-circle-o-notch fa-spin',
				},
				type: 'i',
			},
		]);
		es.continuous = true;
		const wasPaused = es.paused;
		await this.es_resume(es);
		if (Settings.get('es_cl')) {
			es.isLimited = true;
			es.limitCount = Math.min(10, parseInt(Settings.get('es_pages')));
		}
		this.esgst.es_loadNext(async () => {
			es.isLimited = false;
			es.limitCount = 0;
			es.continuous = false;
			if (wasPaused) {
				await this.es_pause(es);
			} else {
				await this.es_resume(es);
			}
			createElements(es.continuousButton, 'atinner', [
				{
					attributes: {
						class: 'fa fa-fast-forward',
					},
					type: 'i',
				},
			]);
		});
	}

	async es_pause(es, firstRun) {
		es.paused = true;
		es.pauseButton.classList.add('esgst-hidden');
		es.resumeButton.classList.remove('esgst-hidden');
		if (!firstRun) {
			const setting = Settings.getFull('es');
			setting.include = setting.include.map((item) => {
				if (item !== Settings.get('es')) {
					return item;
				}
				if (!item.options) {
					item.options = {};
				}
				item.options.pause = es.paused;
				Settings.set('es', item);
				return item;
			});
			await setSetting(`es_${Shared.esgst.name}`, setting);
		}
		es.continuous = false;
		createElements(es.continuousButton, 'atinner', [
			{
				attributes: {
					class: 'fa fa-fast-forward',
				},
				type: 'i',
			},
		]);
	}

	async es_resume(es, firstRun) {
		es.paused = false;
		es.resumeButton.classList.add('esgst-hidden');
		es.pauseButton.classList.remove('esgst-hidden');
		if (!firstRun) {
			const setting = Settings.getFull('es');
			setting.include = setting.include.map((item) => {
				if (item !== Settings.get('es')) {
					return item;
				}
				if (!item.options) {
					item.options = {};
				}
				item.options.pause = es.paused;
				Settings.set('es', item);
				return item;
			});
			await setSetting(`es_${Shared.esgst.name}`, setting);
		}
		if (this.esgst.pagination.getAttribute('data-esgst-intersecting')) {
			this.esgst.es_loadNext(null, true);
		}
	}

	async es_refresh(es) {
		es.refreshButton.removeEventListener('click', this.esgst.es_refresh);
		createElements(es.refreshButton, 'atinner', [
			{
				attributes: {
					class: 'fa fa-circle-o-notch fa-spin',
				},
				type: 'i',
			},
		]);
		let response = await FetchRequest.get(`${this.esgst.searchUrl}${es.pageIndex}`);
		// noinspection JSIgnoredPromiseFromCall
		this.es_getNext(es, true, false, null, response);
		if (this.esgst.giveawaysPath && Settings.get('es_rd')) {
			if (Settings.get('oadd')) {
				// noinspection JSIgnoredPromiseFromCall
				this.esgst.modules.discussionsOldActiveDiscussionsDesign.oadd_load(true);
			} else {
				checkMissingDiscussions(true);
			}
		}
		if (this.esgst.pinnedGiveaways) {
			createElements(this.esgst.pinnedGiveaways, 'atinner', [
				...Array.from(
					response.html.getElementsByClassName('pinned-giveaways__outer-wrap')[0].childNodes
				).map((x) => {
					return {
						context: x,
					};
				}),
			]);
			await endless_load(this.esgst.pinnedGiveaways, true);
			this.esgst.modules.giveawaysPinnedGiveawaysButton.init();
		}

		await EventDispatcher.dispatch(
			Events.PAGE_REFRESHED,
			(await FetchRequest.get(Shared.esgst.sg ? '/giveaways/search?type=wishlist' : '/')).html
		);
	}

	async es_refreshAll(es) {
		es.refreshAllButton.removeEventListener('click', this.esgst.es_refreshAll);
		createElements(es.refreshAllButton, 'atinner', [
			{
				attributes: {
					class: 'fa fa-circle-o-notch fa-spin',
				},
				type: 'i',
			},
		]);
		let page = es.reverseScrolling ? es.pageBase - 1 : es.pageBase + 1,
			response = await FetchRequest.get(`${this.esgst.searchUrl}${page}`);
		// noinspection JSIgnoredPromiseFromCall
		this.es_getNext(es, true, page, null, response);
		const promises = [];
		for (let i = 1, n = es.paginations.length; i < n; ++i) {
			page = es.reverseScrolling ? es.pageBase - (i + 1) : es.pageBase + (i + 1);
			// noinspection JSIgnoredPromiseFromCall
			promises.push(
				this.es_getNext(
					es,
					true,
					page,
					null,
					await FetchRequest.get(`${this.esgst.searchUrl}${page}`)
				)
			);
		}

		await EventDispatcher.dispatch(
			Events.PAGE_REFRESHED,
			(await FetchRequest.get(Shared.esgst.sg ? '/giveaways/search?type=wishlist' : '/')).html
		);

		await Promise.all(promises);
		common.moveAdsDown(es);
		await endless_load(es.mainContext, true);
		this.es_setRemoveEntry(es.mainContext);
		es.refreshAllButton.addEventListener('click', this.esgst.es_refreshAll.bind(this));
		createElements(es.refreshAllButton, 'atinner', [
			{
				attributes: {
					class: 'fa fa-refresh',
				},
				type: 'i',
			},
		]);
		if (Settings.get('ts') && !Settings.get('us')) {
			this.esgst.modules.generalTableSorter.ts_sortTables();
		}
		if (this.esgst.giveawaysPath && Settings.get('es_rd')) {
			if (Settings.get('oadd')) {
				// noinspection JSIgnoredPromiseFromCall
				this.esgst.modules.discussionsOldActiveDiscussionsDesign.oadd_load(true);
			} else {
				checkMissingDiscussions(true);
			}
		}
		if (this.esgst.pinnedGiveaways) {
			createElements(this.esgst.pinnedGiveaways, 'atinner', [
				...Array.from(
					response.html.getElementsByClassName('pinned-giveaways__outer-wrap')[0].childNodes
				).map((x) => {
					return {
						context: x,
					};
				}),
			]);
			await endless_load(this.esgst.pinnedGiveaways, true);
			this.esgst.modules.giveawaysPinnedGiveawaysButton.init();
		}
	}

	es_setPagination(es) {
		let matches = this.esgst.paginationNavigation.children;
		for (let i = 0, n = matches.length; i < n; ++i) {
			matches[i].addEventListener('click', this.es_setPaginationItem.bind(this, es));
		}
	}

	es_setPaginationItem(es, event) {
		event.preventDefault();
		let page = parseInt(event.currentTarget.getAttribute('data-page-number')),
			element = document.querySelector(`.esgst-es-page-${page}:not(.esgst-hidden)`);
		if (element) {
			animateScroll(element.offsetTop, () => {
				this.es_changePagination(es, page);
			});
		} else {
			window.location.href = event.currentTarget.getAttribute('href');
		}
	}

	es_setRemoveEntry(Context) {
		let Matches = Context.getElementsByClassName('table__row-inner-wrap');
		for (let I = 0, N = Matches.length; I < N; ++I) {
			this.es_removeEntry(Matches[I]);
		}
	}

	es_removeEntry(Context) {
		let Default, Loading, Complete, Data;
		Default = Context.getElementsByClassName('table__remove-default')[0];
		if (Default) {
			Loading = Default.nextElementSibling;
			Complete = Loading.nextElementSibling;
			Default.addEventListener('click', async () => {
				let Values, I, N;
				Default.classList.toggle('is-hidden');
				Loading.classList.toggle('is-hidden');
				Values = Context.getElementsByTagName('input');
				Data = '';
				for (I = 0, N = Values.length; I < N; ++I) {
					Data += `${Values[I].getAttribute('name')}=${Values[I].value}${I < N - 1 ? '&' : ''}`;
				}
				Loading.classList.toggle('is-hidden');
				let responseJson = (await FetchRequest.post('/ajax.php', { data: Data })).json;
				if (responseJson.type === 'success') {
					Context.classList.add('is-faded');
					Complete.classList.toggle('is-hidden');
					if (responseJson.points) {
						Shared.header.updatePoints(responseJson.points);
					}
				} else {
					Default.classList.toggle('is-hidden');
				}
			});
		}
	}

	updateUrl(page) {
		const isFirstPage = page === 1;
		const queryParams = window.location.search.replace(
			/\?|&page=(\d+)|page=(\d+)&|page=(\d+)/g,
			''
		);
		let path = '';
		if (window.location.pathname === '/') {
			path = Shared.esgst.sg ? 'giveaways' : 'trades';
		}
		let search = '';
		if (queryParams) {
			search = `${path}/search?${queryParams}${isFirstPage ? '' : `&page=${page}`}`;
		} else if (!isFirstPage) {
			search = `${path}/search?page=${page}`;
		}
		window.history.replaceState(
			null,
			'',
			`${window.location.origin}${window.location.pathname.replace('/search', '')}${search}${
				window.location.hash
			}`
		);
	}
}

const generalEndlessScrolling = new GeneralEndlessScrolling();

export { generalEndlessScrolling };
