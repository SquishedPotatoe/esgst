import { Module } from '../class/Module';
import { Scope } from '../class/Scope';
import { Settings } from '../class/Settings';
import { Shared } from '../class/Shared';
import { common } from './Common';

const getUser = common.getUser.bind(common),
	sortContent = common.sortContent.bind(common);
class Discussions extends Module {
	constructor() {
		super();
		this.info = {
			endless: true,
			id: 'discussions',
			featureMap: {
				endless: this.discussions_load.bind(this),
			},
		};
	}

	async discussions_load(context, main, source, endless) {
		let discussions = await this.discussions_get(context, main, endless);
		if (!discussions.length) return;
		const discussionsToAdd = [];
		const tradesToAdd = [];
		let sortIndex = Scope.findData('current', 'discussions').length;
		for (let i = discussions.length - 1; i > -1; --i) {
			discussions[i].sortIndex = sortIndex;
			switch (discussions[i].type) {
				case 'discussion':
					discussionsToAdd.push(discussions[i]);
					sortIndex += 1;
					break;
				case 'trade':
					tradesToAdd.push(discussions[i]);
					break;
			}
		}
		Scope.addData('current', 'discussions', discussionsToAdd, endless);
		Scope.addData('current', 'trades', tradesToAdd, endless);
		if (!main || this.esgst.discussionsPath) {
			if (
				main &&
				Shared.esgst.df &&
				this.esgst.df.filteredCount &&
				Settings.get(`df_enable${this.esgst.df.type}`)
			) {
				this.esgst.modules.discussionsDiscussionFilters.filters_filter(
					this.esgst.df,
					false,
					endless
				);
			}
			if (Settings.get('ds') && Settings.get('ds_auto')) {
				sortContent(Scope.findData('main', 'discussions'), Settings.get('ds_option'));
			}
		}
		if (!main || this.esgst.tradesPath) {
			if (
				main &&
				Shared.esgst.tf &&
				this.esgst.tf.filteredCount &&
				Settings.get(`tf_enable${this.esgst.tf.type}`)
			) {
				this.esgst.modules.tradesTradeFilters.filters_filter(this.esgst.tf, false, endless);
			}
		}
		if (Settings.get('mm_enableDiscussions') && this.esgst.mm_enable) {
			this.esgst.mm_enable(Scope.findData('current', 'discussions'), 'Discussions');
		}
		for (const feature of this.esgst.discussionFeatures) {
			await feature(
				discussions.filter((x) => !x.menu && x.type === 'discussion'),
				main
			);
		}
		for (const feature of this.esgst.tradeFeatures) {
			await feature(
				discussions.filter((x) => !x.menu && x.type === 'trade'),
				main
			);
		}
	}

	async discussions_get(context, main, endless) {
		let discussions = [];
		let elements = context.querySelectorAll('.esgst-dt-menu');
		for (const element of elements) {
			const id = element.getAttribute('href').match(/\/discussion\/(.+?)\//)[1];
			discussions.push({
				code: id,
				container: element.parentElement,
				context: element,
				id,
				menu: true,
				name: element.textContent.trim(),
				saved: this.esgst.discussions[id],
				tagContext: element,
				tagPosition: 'afterend',
				sortIndex: 0,
				type: '',
			});
		}
		elements = context.querySelectorAll(
			`${
				endless
					? `.esgst-es-page-${endless} .table__row-outer-wrap, .esgst-es-page-${endless} .row_outer_wrap, .esgst-es-page-${endless}.table__row-outer-wrap, .esgst-es-page-${endless}.row_outer_wrap`
					: `.table__row-outer-wrap, .row_outer_wrap`
			}`
		);
		for (let i = elements.length - 1; i > -1; --i) {
			let discussion = await this.discussions_getInfo(elements[i], main);
			if (!discussion) continue;
			discussions.push(discussion);
		}
		if (context === document && main && this.esgst.discussionPath) {
			let discussion = {
				code: window.location.pathname.match(/^\/discussion\/(.+?)\//)[1],
				heading: document.getElementsByClassName('page__heading__breadcrumbs')[0],
				headingContainer: document.getElementsByClassName('page__heading')[0],
				menu: false,
				sortIndex: 0,
				type: '',
			};
			discussion.id = discussion.code;
			discussion.container = discussion.headingContainer;
			discussion.tagContext = discussion.container.querySelector(`[href*="/discussion/"]`);
			discussion.name = discussion.tagContext.textContent.trim();
			discussion.tagPosition = 'afterend';
			discussion.saved = this.esgst.discussions[discussion.code];
			discussion.title = discussion.heading.getElementsByTagName('H1')[0].textContent.trim();
			discussion.category =
				discussion.heading.firstElementChild.nextElementSibling.nextElementSibling.textContent;
			discussion.type = 'discussion';
			discussions.push(discussion);
		}
		return discussions;
	}

	async discussions_getInfo(context, main) {
		let match;
		if (context.closest('.poll')) {
			return;
		}
		const discussion = {};
		discussion.menu = false;
		discussion.sortIndex = 0;
		discussion.outerWrap = context;
		discussion.innerWrap = discussion.outerWrap.querySelector(
			`.table__row-inner-wrap, .row_inner_wrap`
		);
		if (!discussion.innerWrap) {
			return;
		}
		discussion.avatarColumn = discussion.innerWrap.firstElementChild;
		if (!discussion.avatarColumn) {
			return;
		}
		discussion.avatar = discussion.avatarColumn.firstElementChild;
		if (!discussion.avatar) {
			return;
		}
		discussion.headingColumn = discussion.avatarColumn.nextElementSibling;
		discussion.headingContainer = discussion.headingColumn.firstElementChild;
		if (!discussion.headingContainer) {
			return;
		}
		discussion.bookmarkNode = discussion.headingColumn.querySelector(
			'.icon-heading.fa.fa-bookmark, .icon-heading.fa.fa-bookmark-o'
		);
		discussion.closed = discussion.headingContainer.querySelector('.fa-lock');
		discussion.heading = discussion.headingContainer.lastElementChild;
		discussion.info = discussion.headingContainer.nextElementSibling;
		if (!discussion.heading) {
			return;
		}
		discussion.title = discussion.heading.textContent;
		discussion.url = discussion.heading.getAttribute('href');
		if (!discussion.url) {
			return;
		}
		match = discussion.url.match(/(discussion|trade)\/(.+?)\//);
		if (!match) {
			return;
		}
		discussion.type = match[1];
		discussion.code = match[2];
		switch (discussion.type) {
			case 'discussion':
				discussion.saved = this.esgst.discussions[discussion.code];
				if (
					main &&
					Settings.get('df') &&
					Settings.get('df_s') &&
					discussion.saved &&
					discussion.saved.hidden
				) {
					discussion.outerWrap.classList.add('esgst-hidden');
					discussion.outerWrap.setAttribute('data-esgst-not-filterable', 'df');
					if (Settings.get('df_s_s')) {
						Shared.esgst.modules.discussionsDiscussionFilters.updateSingleCounter();
					}
					return;
				}
				discussion.categoryContainer = discussion.info.firstElementChild;
				if (discussion.headingColumn.nextElementSibling) {
					discussion.category = discussion.categoryContainer.textContent;
					discussion[
						discussion.category.replace(/\W/g, '').replace(/^(.)/, (m, p1) => {
							return p1.toLowerCase();
						})
					] = true;
				} else {
					discussion.category = '';
				}
				discussion.createdContainer = discussion.categoryContainer.nextElementSibling;
				break;
			case 'trade':
				discussion.saved = this.esgst.trades[discussion.code];
				if (
					main &&
					Settings.get('tf') &&
					Settings.get('tf_s') &&
					discussion.saved &&
					discussion.saved.hidden
				) {
					discussion.outerWrap.classList.add('esgst-hidden');
					discussion.outerWrap.setAttribute('data-esgst-not-filterable', 'tf');
					if (Settings.get('tf_s_s')) {
						Shared.esgst.modules.tradesTradeFilters.updateSingleCounter();
					}
					return;
				}
				discussion.info = discussion.headingColumn.nextElementSibling;
				discussion.createdContainer = discussion.info.firstElementChild.firstElementChild.nextElementSibling;
				discussion.reputationElement = discussion.info.querySelector('.reputation');

				if (!discussion.reputationElement) {
					break;
				}
				discussion.positiveReputationElement = discussion.reputationElement.querySelector(
					'.is_positive'
				);
				discussion.negativeReputationElement = discussion.reputationElement.querySelector(
					'.is_negative'
				);
				discussion.positiveReputation = parseInt(
					discussion.positiveReputationElement.textContent.replace(/[^\d]/g, '')
				);
				if (!discussion.negativeReputationElement) {
					break;
				}
				discussion.negativeReputation = parseInt(
					discussion.negativeReputationElement.textContent.replace(/[^\d]/g, '')
				);
				break;
		}
		discussion.bookmarked = !!discussion.bookmarkNode;
		if (discussion.saved) {
			discussion.visited = discussion.saved.visited;
			discussion.subscribed = typeof discussion.saved.subscribed !== 'undefined';
		}
		if (discussion.createdContainer) {
			discussion.createdTime = discussion.createdContainer.textContent;
			discussion.createdTimestamp =
				parseInt(discussion.createdContainer.getAttribute('data-timestamp')) * 1e3;
			if (this.esgst.giveawaysPath) {
				discussion.author = (
					discussion.avatar.getAttribute('href') || discussion.avatar.dataset.href
				).match(/\/user\/(.+)/)[1];
			} else {
				discussion.author = discussion.createdContainer.nextElementSibling.textContent;
			}
		}
		if (!discussion.author) {
			return;
		}
		discussion.authors = [discussion.author.toLowerCase()];
		discussion.created = discussion.author === Settings.get('username');
		discussion.poll = discussion.outerWrap.querySelector('.fa-align-left');
		discussion.commentsColumn = this.esgst.st
			? discussion.headingColumn.nextElementSibling.nextElementSibling
			: discussion.headingColumn.nextElementSibling || discussion.headingColumn.children[1];
		if (discussion.commentsColumn) {
			discussion.comments = parseInt(
				discussion.commentsColumn.firstElementChild.textContent.replace(/,/g, '')
			);
			if (
				this.esgst.giveawaysPath &&
				Settings.get('adots') &&
				Settings.get('adots_index') === 1 &&
				Settings.get('ns')
			) {
				discussion.commentsColumn.firstElementChild.textContent = discussion.commentsColumn.firstElementChild.textContent.replace(
					/\sComments/,
					''
				);
			}
		}
		discussion.lastPost = discussion.outerWrap.querySelector(
			`.table__column--last-comment, .row_trade_update_user`
		);
		if (discussion.lastPost && discussion.lastPost.firstElementChild && this.esgst.st) {
			discussion.lastPostTime = discussion.lastPost.firstElementChild.firstElementChild.nextElementSibling;
			discussion.lastPostAuthor = discussion.lastPostTime.parentNode.nextElementSibling.firstElementChild;
			discussion.lastPostCode = discussion.lastPostAuthor.nextElementSibling.nextElementSibling;

			if (discussion.lastPostCode && discussion.lastPostCode.getAttribute('href').match(/\/comment\/(.+)/)) {
				discussion.lastPostCode = discussion.lastPostCode.getAttribute('href').match(/\/comment\/(.+)/)[1];
				discussion.wasLastPostBump = false;
			} else {
				discussion.lastPostCode = null;
				discussion.wasLastPostBump = true;
			}
			discussion.lastPostAuthor = discussion.lastPostAuthor.textContent;
			discussion.lastPostTimestamp = discussion.lastPostTime.getAttribute('data-timestamp');
			discussion.lastPostTime = discussion.lastPostTime.textContent;
		} else if (discussion.lastPost && discussion.lastPost.firstElementChild) {
			discussion.lastPostTime = discussion.lastPost.firstElementChild.firstElementChild;
			discussion.lastPostAuthor = discussion.lastPostTime.nextElementSibling;
			discussion.lastPostCode = discussion.lastPostAuthor.lastElementChild
				.getAttribute('href')
				.match(/\/comment\/(.+)/);
			if (discussion.lastPostCode) {
				discussion.lastPostCode = discussion.lastPostCode[1];
			}
			discussion.lastPostAuthor = discussion.lastPostAuthor.firstElementChild.textContent;
			discussion.lastPostTimestamp = discussion.lastPostTime.getAttribute('data-timestamp');
			discussion.lastPostTime = discussion.lastPostTime.firstElementChild.textContent;
		}
		discussion.id = discussion.code;
		discussion.name = discussion.title;
		discussion.container = discussion.headingContainer;
		discussion.tagContext = discussion.headingContainer;
		discussion.tagPosition = 'beforeend';
		return discussion;
	}
}

const discussionsModule = new Discussions();

export { discussionsModule };
