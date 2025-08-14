import { DOM } from '../../class/DOM';
import { FetchRequest } from '../../class/FetchRequest';
import { Module } from '../../class/Module';
import { permissions } from '../../class/Permissions';
import { Settings } from '../../class/Settings';
import { Shared } from '../../class/Shared';
import { NotificationBar } from '../../components/NotificationBar';

class GroupsGroupStats extends Module {
	constructor() {
		super();
		this.info = {
			description: () => (
				<ul>
					<li>
						Adds some columns to your{' '}
						<a href="https://www.steamgifts.com/account/steam/groups">groups</a> page that show some
						stats about each group.
					</li>
				</ul>
			),
			features: {
				gs_sent: {
					name: 'Sent',
					sg: true,
				},
				gs_received: {
					name: 'Received',
					sg: true,
				},
				gs_giftDifference: {
					name: 'Gift Difference',
					sg: true,
				},
				gs_valueDifference: {
					name: 'Value Difference',
					sg: true,
				},
				gs_firstGiveaway: {
					name: 'First Giveaway',
					sg: true,
				},
				gs_lastGiveaway: {
					name: 'Last Giveaway',
					sg: true,
				},
				gs_averageEntries: {
					name: 'Average Entries',
					sg: true,
				},
				gs_contributors: {
					name: 'Contributors',
					sg: true,
				},
				gs_winners: {
					name: 'Winners',
					sg: true,
				},
				gs_giftsSent: {
					name: 'Gifts Sent',
					sg: true,
				},
				gs_giveaways: {
					name: 'Giveaways',
					sg: true,
				},
				gs_users: {
					name: 'Users',
					sg: true,
				},
				gs_creationDate: {
					name: `Creation Date (takes a bit longer to retrieve the date from Steam)`,
					sg: true,
				},
				gs_type: {
					name: `Type (takes a bit longer to check if the group is open, restricted, closed or an official game group on Steam)`,
					sg: true,
				},
			},
			id: 'gs',
			name: 'Group Stats',
			sg: true,
			type: 'groups',
		};
	}

	async init() {
		if (!Shared.common.isCurrentPath('Steam - Groups')) {
			return;
		}

		if (
			(Settings.get('gs_creationDate') || Settings.get('gs_type')) &&
			!(await permissions.contains([['steamCommunity']]))
		) {
			return;
		}

		DOM.insert(
			document.getElementsByClassName('table__heading')[0],
			'beforeend',
			<fragment>
				{Settings.get('gs_sent') ? (
					<div className="table__column--width-small text-center">Sent</div>
				) : null}
				{Settings.get('gs_received') ? (
					<div className="table__column--width-small text-center">Received</div>
				) : null}
				{Settings.get('gs_giftDifference') ? (
					<div className="table__column--width-small text-center">Gift Difference</div>
				) : null}
				{Settings.get('gs_valueDifference') ? (
					<div className="table__column--width-small text-center">Value Difference</div>
				) : null}
				{Settings.get('gs_firstGiveaway') ? (
					<div className="table__column--width-small text-center">First Giveaway</div>
				) : null}
				{Settings.get('gs_lastGiveaway') ? (
					<div className="table__column--width-small text-center">Last Giveaway</div>
				) : null}
				{Settings.get('gs_averageEntries') ? (
					<div className="table__column--width-small text-center">Average Entries</div>
				) : null}
				{Settings.get('gs_contributors') ? (
					<div className="table__column--width-small text-center">Contributors</div>
				) : null}
				{Settings.get('gs_winners') ? (
					<div className="table__column--width-small text-center">Winners</div>
				) : null}
				{Settings.get('gs_giftsSent') ? (
					<div className="table__column--width-small text-center">Gifts Sent</div>
				) : null}
				{Settings.get('gs_giveaways') ? (
					<div className="table__column--width-small text-center">Giveaways</div>
				) : null}
				{Settings.get('gs_users') ? (
					<div className="table__column--width-small text-center">Users</div>
				) : null}
				{Settings.get('gs_creationDate') ? (
					<div className="table__column--width-small text-center">Creation Date</div>
				) : null}
				{Settings.get('gs_type') ? (
					<div className="table__column--width-small text-center">Type</div>
				) : null}
			</fragment>
		);
		this.notification = NotificationBar.create().insert(
			Shared.esgst.pagination.previousElementSibling,
			'beforebegin'
		);
		this.numGroups = 0;
		Shared.esgst.groupFeatures.push(this.gs_getGroups.bind(this));
	}

	gs_getGroups(groups, main) {
		this.notification.setLoading('Loading stats for groups...');
		this.numGroups += groups.length;
		const promises = [];
		for (const group of groups) {
			const promise = this.gs_addStatus(group, main);
			promise.then(() =>
				this.notification.setMessage(`Loading stats for groups (${--this.numGroups} left)...`)
			);
			promises.push(promise);
		}
		Promise.all(promises).then(() => {
			if (this.numGroups === 0) {
				this.notification.setSuccess('Stats for groups loaded.');
			}
		});
	}

	async gs_addStatus(group, main) {
		const response = await FetchRequest.get(
			`${group.url}/users/search?q=${Settings.get('username')}`
		);

		const userContext = response.html.querySelector('.table__row-inner-wrap');
		if (
			!userContext ||
			userContext.querySelector('.table__column__heading').textContent !== Settings.get('username')
		) {
			return;
		}

		const items = [];

		Object.assign(group, {
			firstGiveaway: 0,
			lastGiveaway: 0,
			averageEntries: 0,
			contributors: 0,
			winners: 0,
			giveaways: 0,
			users: 0,
			giftsSent: 0,
			giftsSentValue: 0,
			sent: 0,
			sentValue: 0,
			received: 0,
			receivedValue: 0,
			giftDifference: 0,
			valueDifference: 0,
		});

		const columnRegex = /^([+-]?\$?\d+(?:\.\d+)?)(?:.*?\(\$?([+-]?\d+(?:\.\d+)?)\))?$/;
		const columnCache = new Map();
		function parseColumnText(text) {
			const cleaned = (text || '').trim().replace(/,/g, '');
			if (columnCache.has(cleaned)) return columnCache.get(cleaned);

			const matches = columnRegex.exec(cleaned);
			const result = matches
				? {
					main: parseFloat(matches[1].replace('$', '')),
					value: matches[2] !== undefined ? parseFloat(matches[2]) : null,
				}
				: { main: null, value: null };

			columnCache.set(cleaned, result);
			return result;
		}

		const columnConfig = {
			0: {
				setting: 'gs_sent',
				assign: (main, value) => {
					group.sent = main;
					group.sentValue = value ?? 0;
				},
			},
			1: {
				setting: 'gs_received',
				assign: (main, value) => {
					group.received = main;
					group.receivedValue = value ?? 0;
				},
			},
			2: {
				setting: 'gs_giftDifference',
				assign: (main) => {
					group.giftDifference = main;
				},
			},
			3: {
				setting: 'gs_valueDifference',
				assign: (main) => {
					group.valueDifference = main;
				},
			},
		};

		const tableColumns = userContext.querySelectorAll('.table__column--width-small');
		for (const [index, column] of tableColumns.entries()) {
			const cfg = columnConfig[index];
			if (cfg && Settings.get(cfg.setting)) {
				const { main, value } = parseColumnText(column.textContent);
				if (main !== null) {
					cfg.assign(main, value);
					items.push(column);
				}
			}
		}

		function parseTimestamp(element) {
			const timestampElement = element.querySelector('[data-timestamp]');
			return timestampElement
				? parseInt(timestampElement.getAttribute('data-timestamp')) * 1e3
				: 0;
		}

		const rowConfig = {
			'First Giveaway': {
				setting: 'gs_firstGiveaway',
				assign: (el) => {
					group.firstGiveaway = parseTimestamp(el);
				},
			},
			'Last Giveaway': {
				setting: 'gs_lastGiveaway',
				assign: (el) => {
					group.lastGiveaway = parseTimestamp(el);
				},
			},
			'Average Entries': {
				setting: 'gs_averageEntries',
				assign: (el) => {
					group.averageEntries = parseInt(el.textContent.replace(/,/g, '')) || 0;
				},
			},
			Contributors: {
				setting: 'gs_contributors',
				assign: (el) => {
					group.contributors = parseInt(el.textContent.replace(/,/g, '')) || 0;
				},
			},
			Winners: {
				setting: 'gs_winners',
				assign: (el) => {
					group.winners = parseInt(el.textContent.replace(/,/g, '')) || 0;
				},
			},
			'Gifts Sent': {
				setting: 'gs_giftsSent',
				assign: (el) => {
					const matches = el.textContent.replace(/,/g, '').match(/^(\d+).*?\(\$?([+-]?\d+(?:\.\d+)?)\)/);
					group.giftsSent = matches ? parseInt(matches[1]) : 0;
					group.giftsSentValue = matches ? parseFloat(matches[2]) : 0;
				},
			},
		};

		const tableRows = response.html.querySelectorAll('.featured__table__row__left');
		for (const row of tableRows) {
			const label = row.textContent.trim();
			const cfg = rowConfig[label];
			if (cfg && Settings.get(cfg.setting)) {
				const el = row.nextElementSibling;
				cfg.assign(el);
				el.classList.remove('featured__table__row__right');
				el.classList.add('table__column--width-small', 'text-center');
				items.push(el);
			}
		}

		const sidebarItems = response.html.querySelectorAll('.sidebar__navigation__item__name');
		for (const item of sidebarItems) {
			const text = item.textContent.trim();
			const element = item.nextElementSibling.nextElementSibling;
			let append = false;
			if (text === 'Giveaways' && Settings.get('gs_giveaways')) {
				group.giveaways = parseInt(element.textContent.replace(/,/g, '')) || 0;
				append = true;
			} else if (text === 'Users' && Settings.get('gs_users')) {
				group.users = parseInt(element.textContent.replace(/,/g, '')) || 0;
				append = true;
			}
			if (append) {
				element.classList.remove('sidebar__navigation__item__count');
				element.classList.add('table__column--width-small', 'text-center');
				items.push(element);
			}
		}

		const steamIdElement = response.html.querySelector(`a[href*="/gid/"]`);
		group.steamId = steamIdElement.getAttribute('href').match(/\/gid\/(\d+)/)[1];
		group.creationDate = 0;
		group.type = '-';

		if (Settings.get('gs_creationDate') || Settings.get('gs_type')) {
			const response = await FetchRequest.get(
				`https://steamcommunity.com/gid/${group.steamId}?cc=us&l=english`,
				{ anon: true }
			);

			if (Settings.get('gs_creationDate')) {
				const groupStatLabels = response.html.querySelectorAll('.groupstat > .label');
				let date = '-';
				for (const label of groupStatLabels) {
					if (/founded/i.test(label.textContent)) {
						date = label.nextElementSibling.textContent.trim();
						group.creationDate = new Date(date);
						break;
					}
				}
				items.push(
					<div className="table__column--width-small text-center">
						<span data-timestamp={group.creationDate / 1e3}>{date}</span>
					</div>
				);
			}

			if (Settings.get('gs_type')) {
				if (response.url.match(/steamcommunity\.com\/games\//)) {
					group.type = 'Official Game Group';
					group.officialGameGroup = true;
				} else {
					const groupType = response.html.querySelector('.grouppage_join_area');
					const text = groupType ? groupType.textContent.trim() : '';
					if (/join group/i.test(text)) {
						group.type = 'Open';
						group.open = true;
					} else if (/request to join/i.test(text)) {
						group.type = 'Restricted';
						group.restricted = true;
					} else if (/membership by invitation only/i.test(text)) {
						group.type = 'Closed';
						group.closed = true;
					}
				}
				items.push(<div className="table__column--width-small text-center">{group.type}</div>);
			}
		}

		DOM.insert(group.container, 'afterend', <fragment>{items}</fragment>);

		if (
			main &&
			Shared.esgst.gpf &&
			Shared.esgst.gpf.filteredCount &&
			Settings.get(`gpf_enable${Shared.esgst.gpf.type}`)
		) {
			Shared.esgst.modules.groupsGroupFilters.filters_filter(Shared.esgst.gpf);
		}
	}
}

const groupsGroupStats = new GroupsGroupStats();

export { groupsGroupStats };
