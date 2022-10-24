import dateFns_formatDistanceStrict from 'date-fns/formatDistanceStrict';
import { Checkbox } from '../class/Checkbox';
import { DOM } from '../class/DOM';
import { FetchRequest } from '../class/FetchRequest';
import { LocalStorage } from '../class/LocalStorage';
import { Lock } from '../class/Lock';
import { Logger } from '../class/Logger';
import { permissions } from '../class/Permissions';
import { Popup } from '../class/Popup';
import { Settings } from '../class/Settings';
import { Shared } from '../class/Shared';
import { Button } from '../components/Button';
import { NotificationBar } from '../components/NotificationBar';
import { PageHeading } from '../components/PageHeading';
import { Utils } from '../lib/jsUtils';

let toSave = {};

const SYNC_KEYS = {
	syncGroups: {
		dependencies: [],
		key: 'Groups',
		name: 'Groups',
	},
	syncWhitelist: {
		dependencies: [],
		key: 'Whitelist',
		name: 'Whitelist',
	},
	syncBlacklist: {
		dependencies: [],
		key: 'Blacklist',
		name: 'Blacklist',
	},
	syncSteamFriends: {
		dependencies: [],
		key: 'SteamFriends',
		name: `Steam Friends (requires Steam API key)`,
	},
	syncHiddenGames: {
		dependencies: [],
		key: 'HiddenGames',
		name: 'Hidden Games',
	},
	syncGames: {
		dependencies: [],
		key: 'Games',
		name: 'Owned/Wishlisted/Ignored Games',
	},
	syncFollowedGames: {
		dependencies: [],
		key: 'FollowedGames',
		name: 'Followed Games',
	},
	syncWonGames: {
		dependencies: [],
		key: 'WonGames',
		name: 'Won Games',
	},
	syncReducedCvGames: {
		dependencies: [],
		key: 'ReducedCvGames',
		name: 'Reduced CV Games',
	},
	syncNoCvGames: {
		dependencies: [],
		key: 'NoCvGames',
		name: 'No CV Games',
	},
	syncHltbTimes: {
		dependencies: [],
		key: 'HltbTimes',
		name: 'HLTB Times',
	},
	syncDelistedGames: {
		dependencies: [],
		key: 'DelistedGames',
		name: 'Delisted Games',
	},
	syncGiveaways: {
		dependencies: [],
		key: 'Giveaways',
		name: 'Giveaways',
	},
	syncWonGiveaways: {
		dependencies: [],
		key: 'WonGiveaways',
		name: 'Won Giveaways',
	},
};

async function runSilentSync(parameters) {
	const button = Shared.header.addButtonContainer({
		buttonIcon: 'fa fa-refresh fa-spin',
		buttonName: 'ESGST Sync',
		isActive: true,
		isNotification: true,
		side: 'right',
	});

	button.nodes.buttonIcon.title = 'ESGST is syncing your data... Please do not close this window.';

	Shared.esgst.parameters = {
		...Shared.esgst.parameters,
		...Utils.getQueryParams(`?autoSync=true&${parameters.replace(/&$/, '')}`),
	};
	const syncer = await setSync(false, true);
	button.nodes.outer.addEventListener('click', () => syncer.popup.open());
	Shared.esgst.isSyncing = true;
	await sync(syncer);
	Shared.esgst.isSyncing = false;

	button.nodes.outer.classList.remove('nav__button-container--active');
	button.nodes.outer.classList.add('nav__button-container--inactive');
	button.nodes.buttonIcon.className = 'fa fa-check';
	button.nodes.buttonIcon.title = 'ESGST has finished syncing, click here to see the results.';
}

function getDependencies(syncer, feature, id) {
	if (feature.syncKeys) {
		for (const key of feature.syncKeys) {
			syncer.switchesKeys[`sync${key}`].dependencies.push(id);
		}
	}
	if (feature.features) {
		for (const subId in feature.features) {
			getDependencies(syncer, feature.features[subId], subId);
		}
	}
}

/**
 * @returns {Promise<Object>}
 */
async function setSync(isPopup = false, isSilent = false) {
	let syncer = {};
	syncer.canceled = false;
	syncer.isSilent = isSilent || Shared.esgst.isFirstRun;
	if (Shared.esgst.parameters.autoSync) {
		syncer.parameters = Shared.esgst.parameters;
	}
	let containerr = null;
	let context = null;
	let popup = null;
	if (isPopup || syncer.isSilent) {
		syncer.popup = popup = new Popup({
			addScrollable: 'left',
			settings: true,
		});
		containerr = popup.description;
		context = popup.scrollable;
		if (!Shared.esgst.isFirstRun && (!syncer.isSilent || Settings.get('openAutoSyncPopup'))) {
			popup.open();
		}
	} else {
		containerr = context = Shared.esgst.sidebar.nextElementSibling;
		containerr.innerHTML = '';
		context.setAttribute('data-esgst-popup', 'true');
	}
	const heading = PageHeading.create('sync', [
		{
			name: 'ESGST',
			url: Shared.esgst.settingsUrl,
		},
		{
			name: 'Sync',
			url: Shared.esgst.syncUrl,
		},
	]).insert(containerr, 'afterbegin').nodes.outer;
	if (!isPopup && !syncer.isSilent) {
		Shared.esgst.mainPageHeading = heading;
	}
	if (syncer.isSilent) {
		DOM.insert(context, 'beforeend', <div ref={(ref) => (syncer.area = ref)}></div>);
	} else {
		DOM.insert(
			context,
			'beforeend',
			<div className="esgst-menu-split">
				<div className="esgst-sync-options"></div>
				<div className="esgst-sync-area"></div>
			</div>
		);
		Button.create([
			{
				color: 'green',
				icons: [],
				name: 'Save Changes',
				onClick: async () => {
					await Shared.common.lockAndSaveSettings(toSave);
					toSave = {};
					if (isPopup) {
						popup.close();
					} else {
						window.location.reload();
					}
				},
			},
			{
				color: 'white',
				icons: [],
				name: 'Saving...',
			},
		]).insert(context, 'beforeend');
		syncer.container = context.querySelector('.esgst-sync-options');
		syncer.area = context.querySelector('.esgst-sync-area');
		DOM.insert(
			syncer.area,
			'beforeend',
			<div ref={(ref) => (syncer.notificationArea = ref)}></div>
		);
		syncer.manual = /** @type {{ check: boolean, content: Element[], name: string }} */ ({
			check: true,
			content: [],
			name: 'Manual',
		});
		syncer.automatic = /** @type {{ check: boolean, content: Element[], name: string }} */ ({
			check: true,
			content: [],
			name: 'Automatic',
		});
		syncer.switchesKeys = SYNC_KEYS;
		syncer.switches = {};
		for (const type in Shared.esgst.features) {
			for (const id in Shared.esgst.features[type].features) {
				getDependencies(syncer, Shared.esgst.features[type].features[id], id);
			}
		}
		for (let id in syncer.switchesKeys) {
			if (syncer.switchesKeys.hasOwnProperty(id)) {
				const info = syncer.switchesKeys[id];
				const checkbox = new Checkbox(null, Settings.get(id));
				checkbox.onChange = () => {
					toSave[`sync${info.key}`] = checkbox.value;
					Settings.set(`sync${info.key}`, checkbox.value);
				};
				syncer.switches[id] = checkbox;
				syncer.manual.content.push(
					<div>
						<i
							className="fa fa-question-circle"
							title={`This is required for the following features:\n\n${info.dependencies
								.map((x) => Shared.common.getFeatureName(null, x))
								.join('\n')}`}
						></i>{' '}
						{checkbox.checkbox} <span>{info.name}</span>
					</div>
				);
				if (info.key !== 'HiddenGames' && info.key !== 'Whitelist' && info.key !== 'Blacklist') {
					setAutoSync(info.key, info.name, syncer);
				}
				addNotificationBars(syncer, info);
			}
		}
		syncer.button = Button.create([
			{
				color: 'green',
				icons: ['fa-refresh'],
				name: 'Sync',
				onClick: sync.bind(null, syncer),
			},
			{
				template: 'error',
				name: 'Cancel',
				switchTo: { onReturn: 0 },
				onClick: cancelSync.bind(null, syncer),
			},
		]).build();
		syncer.manual.content.push(
			<div className="esgst-button-group">
				<span>Select:</span>
				{
					Button.create([
						{
							color: 'white',
							icons: ['fa-square'],
							name: 'All',
							onClick: Shared.common.selectSwitches.bind(
								Shared.common,
								syncer.switches,
								'check',
								null
							),
						},
						{
							template: 'loading',
							isDisabled: true,
							name: '',
						},
					]).build().nodes.outer
				}
				{
					Button.create([
						{
							color: 'white',
							icons: ['fa-square-o'],
							name: 'None',
							onClick: Shared.common.selectSwitches.bind(
								Shared.common,
								syncer.switches,
								'uncheck',
								null
							),
						},
						{
							template: 'loading',
							isDisabled: true,
							name: '',
						},
					]).build().nodes.outer
				}
				{
					Button.create([
						{
							color: 'white',
							icons: ['fa-plus-square-o'],
							name: 'Inverse',
							onClick: Shared.common.selectSwitches.bind(
								Shared.common,
								syncer.switches,
								'toggle',
								null
							),
						},
						{
							template: 'loading',
							isDisabled: true,
							name: '',
						},
					]).build().nodes.outer
				}
			</div>,
			syncer.button.nodes.outer
		);
		syncer.automatic.content.push(
			<div className="esgst-description">
				Select how often you want the automatic sync to run (in days) or 0 to disable it.
			</div>
		);
		Shared.common.createFormRows(syncer.container, 'beforeend', {
			items: [syncer.manual, syncer.automatic],
		});
		if (Settings.get('at')) {
			Shared.esgst.modules.generalAccurateTimestamp.at_getTimestamps(syncer.notificationArea);
		}
	}
	syncer.progressBar = NotificationBar.create().insert(syncer.area, 'beforeend').hide();
	syncer.results = Shared.common.createElements(syncer.area, 'beforeend', [
		{
			type: 'div',
		},
	]);
	if (!syncer.isSilent && !Shared.esgst.isSyncing && syncer.parameters && syncer.button) {
		syncer.button.onClick();
	}
	return syncer;
}

function updateSyncDates(syncer) {
	syncer.notificationArea.innerHTML = '';
	for (let id in syncer.switchesKeys) {
		if (syncer.switchesKeys.hasOwnProperty(id)) {
			const info = syncer.switchesKeys[id];
			addNotificationBars(syncer, info);
		}
	}
	if (Settings.get('at')) {
		Shared.esgst.modules.generalAccurateTimestamp.at_getTimestamps(syncer.notificationArea);
	}
}

function addNotificationBars(syncer, info) {
	const notificationBar = NotificationBar.create().build();
	let timestamp = Settings.get(`lastSync${info.key}`);
	if (timestamp) {
		notificationBar.setSuccess(
			<fragment>
				Synced <span>{info.name}</span>{' '}
				<span data-timestamp={timestamp / 1e3}>
					{dateFns_formatDistanceStrict(timestamp, new Date())}
				</span>
				{' ago.'}
			</fragment>
		);
	} else {
		notificationBar.setWarning(
			<fragment>
				Never synced <span>{info.name}</span>
			</fragment>
		);
	}
	notificationBar.insert(syncer.notificationArea, 'beforeend');
}

function setAutoSync(key, name, syncer) {
	let days = [];
	for (let i = 0; i < 31; ++i) {
		days.push(<option selected={i === Settings.get(`autoSync${key}`) ? true : null}>{i}</option>);
	}
	syncer.automatic.content.push(
		<div>
			<select
				className="esgst-auto-sync"
				onchange={(event) => {
					Settings.set(`autoSync${key}`, parseInt(event.currentTarget.value));
					toSave[`autoSync${key}`] = parseInt(event.currentTarget.value);
				}}
			>
				{days}
			</select>
			<span>{name}</span>
		</div>
	);
}

function cancelSync(syncer) {
	if (syncer.process) {
		syncer.process.stop();
	}
	syncer.progressBar.reset().hide();
	syncer.canceled = true;
}

//use: syncer.results, syncer.progressBar, syncer.parameters
async function sync(syncer) {
	const now = Date.now();

	if (
		(syncer.parameters && syncer.parameters.HiddenGames) ||
		(!syncer.parameters && Settings.get('syncHiddenGames'))
	) {
		if (now - Settings.get('lastSyncHiddenGames') > 2592000000) {
			if (Settings.get('lastPageHiddenGames') === 0) {
				const doContinue = await Shared.common.createConfirmationAsync(
					`WARNING: You are going to sync your hidden games. This is a process that may take a very long time, depending on how many games you have on your list, as the requests will be limited to 1 per second to avoid making a lot of requests to SteamGifts in a short period of time. Also keep in mind that this is a cumulative sync, which means that if you cancel the sync and sync again later, it will pick up from where it left off.${
						Settings.get('lastSyncHiddenGames') > 0
							? ' Since you have already synced your hidden games once before, you do not need to do it ever again, because ESGST detects when you add/remove a game to/from the list and automatically updates your data.'
							: ''
					} If you're sure you want to continue, click 'Yes', otherwise click 'No' and disable hidden games sync. You can only sync your hidden games once per 30 days.`
				);
				if (!doContinue) {
					return;
				}
			}
		} else {
			Shared.common.createAlert(
				'WARNING: You have synced your hidden games in the last 30 days. Please disable it in order to continue.'
			);
			return;
		}
	}
	if (
		(syncer.parameters && (syncer.parameters.Whitelist || syncer.parameters.Blacklist)) ||
		(!syncer.parameters && (Settings.get('syncWhitelist') || Settings.get('syncBlacklist')))
	) {
		if (
			now - Settings.get('lastSyncWhitelist') > 2592000000 &&
			now - Settings.get('lastSyncBlacklist') > 2592000000
		) {
			if (Settings.get('lastPageWhitelist') === 0 || Settings.get('lastPageBlacklist') === 0) {
				const doContinue = await Shared.common.createConfirmationAsync(
					`WARNING: You are going to sync your whitelist or blacklist. This is a process that may take a very long time, depending on how many users you have on your list, as the requests will be limited to 1 per second to avoid making a lot of requests to SteamGifts in a short period of time. Also keep in mind that this is a cumulative sync, which means that if you cancel the sync and sync again later, it will pick up from where it left off.${
						Settings.get('lastSyncWhitelist') > 0 || Settings.get('lastSyncBlacklist') > 0
							? ' Since you have already synced your whitelist or blacklist once before, you do not need to do it ever again, because ESGST detects when you add/remove a user to/from the list and automatically updates your data.'
							: ''
					} If you're sure you want to continue, click 'Yes', otherwise click 'No' and disable whitelist or blacklist sync. You can only sync your whitelist or blacklist once per 30 days.`
				);
				if (!doContinue) {
					return;
				}
			}
		} else {
			Shared.common.createAlert(
				'WARNING: You have synced your whitelist or blacklist in the last 30 days. Please disable it in order to continue.'
			);
			return;
		}
	}

	syncer.canceled = false;

	if (!Shared.esgst.isFirstRun) {
		await Shared.common.setSetting('lastSync', now);
		syncer.results.innerHTML = '';
		syncer.progressBar.setLoading(null).show();
	}

	// if this is the user's fist time using the script, only sync steam id and stop
	if (Shared.esgst.isFirstRun) {
		return;
	}

	// if sync has been canceled stop
	if (syncer.canceled) {
		return;
	}

	syncer.failed = {};

	// sync groups
	if (
		Shared.esgst.sg &&
		((syncer.parameters && syncer.parameters.Groups) ||
			(!syncer.parameters && Settings.get('syncGroups')))
	) {
		syncer.progressBar.setMessage('Syncing your Steam groups...');
		syncer.groups = {};
		let savedGroups = JSON.parse(Shared.common.getValue('groups'));
		if (!Array.isArray(savedGroups)) {
			let newGroups, savedGiveaways;
			newGroups = [];
			for (let key in savedGroups) {
				if (savedGroups.hasOwnProperty(key)) {
					newGroups.push(savedGroups[key]);
				}
			}
			savedGroups = newGroups;
			await Shared.common.setValue('groups', JSON.stringify(savedGroups));
			savedGiveaways = JSON.parse(Shared.common.getValue('giveaways'));
			for (let key in savedGiveaways) {
				if (savedGiveaways.hasOwnProperty(key)) {
					delete savedGiveaways[key].groups;
				}
			}
			await Shared.common.setValue('giveaways', JSON.stringify(savedGiveaways));
		}
		syncer.currentGroups = {};
		for (let i = 0, n = savedGroups.length; i < n; ++i) {
			if (savedGroups[i] && savedGroups[i].member && savedGroups[i].steamId) {
				syncer.currentGroups[savedGroups[i].steamId] = savedGroups[i].name;
			}
		}
		syncer.newGroups = {};
		syncer.savedGroups = savedGroups;
		let nextPage = 1;
		let pagination = null;
		do {
			let elements, responseHtml;
			responseHtml = (
				await FetchRequest.get(
					`https://www.steamgifts.com/account/steam/groups/search?page=${nextPage}`
				)
			).html;
			elements = responseHtml.getElementsByClassName('table__row-outer-wrap');
			for (let i = 0, n = elements.length; !syncer.canceled && i < n; i++) {
				let code, element, heading, name;
				element = elements[i];
				heading = element.getElementsByClassName('table__column__heading')[0];
				code = heading.getAttribute('href').match(/\/group\/(.+?)\/(.+)/)[1];
				name = heading.textContent;
				let j;
				for (
					j = syncer.savedGroups.length - 1;
					j >= 0 && syncer.savedGroups[j].code !== code;
					--j
				) {}
				if (j >= 0 && syncer.savedGroups[j].steamId) {
					syncer.groups[code] = {
						member: true,
					};
					syncer.newGroups[syncer.savedGroups[j].steamId] = name;
				} else {
					let avatar, steamId;
					avatar = element
						.getElementsByClassName('table_image_avatar')[0]
						.style.backgroundImage.match(/url\("(.+)"\)/)[1];
					steamId = (await FetchRequest.get(`/group/${code}/`)).html
						.getElementsByClassName('sidebar__shortcut-inner-wrap')[0]
						.firstElementChild.getAttribute('href')
						.match(/\d+/)[0];
					syncer.groups[code] = {
						avatar: avatar,
						code: code,
						member: true,
						name: name,
						steamId: steamId,
					};
					syncer.newGroups[steamId] = name;
				}
			}
			pagination = responseHtml.getElementsByClassName('pagination__navigation')[0];
			nextPage += 1;
		} while (
			!syncer.canceled &&
			pagination &&
			!pagination.lastElementChild.classList.contains('is-selected')
		);
		await Shared.common.lockAndSaveGroups(syncer.groups, true);
		let missing, neww;
		missing = [];
		neww = [];
		for (let id in syncer.currentGroups) {
			if (syncer.currentGroups.hasOwnProperty(id)) {
				if (!syncer.newGroups[id]) {
					missing.push(
						<a href={`http://steamcommunity.com/gid/${id}`}>{syncer.currentGroups[id]}</a>,
						', '
					);
				}
			}
		}
		for (let id in syncer.newGroups) {
			if (syncer.newGroups.hasOwnProperty(id)) {
				if (!syncer.currentGroups[id]) {
					neww.push(
						<a href={`http://steamcommunity.com/gid/${id}`}>{syncer.newGroups[id]}</a>,
						', '
					);
				}
			}
		}
		missing.pop();
		neww.pop();
		syncer.jsx = [];
		if (missing.length) {
			syncer.jsx.push(
				<div>
					<span className="esgst-bold">Missing groups:</span> {missing}
				</div>
			);
		}
		if (neww.length) {
			syncer.jsx.push(
				<div>
					<span className="esgst-bold">New groups:</span> {neww}
				</div>
			);
		}
		DOM.insert(
			syncer.results,
			'beforeend',
			<fragment>
				<div>Groups synced.</div>
				{syncer.jsx}
			</fragment>
		);
	}

	// if sync has been canceled stop
	if (syncer.canceled) {
		return;
	}

	// sync whitelist and blacklist
	if (
		(((syncer.parameters && syncer.parameters.Whitelist) ||
			(!syncer.parameters && Settings.get('syncWhitelist'))) &&
			(now - Settings.get('lastSyncWhitelist') > 2592000000 ||
				Settings.get('lastPageWhitelist') > 0)) ||
		(((syncer.parameters && syncer.parameters.Blacklist) ||
			(!syncer.parameters && Settings.get('syncBlacklist'))) &&
			(now - Settings.get('lastSyncBlacklist') > 2592000000 ||
				Settings.get('lastPageBlacklist') > 0))
	) {
		if (
			(syncer.parameters && syncer.parameters.Whitelist) ||
			(!syncer.parameters && Settings.get('syncWhitelist'))
		) {
			if (Settings.get('lastPageWhitelist') === 0) {
				await Shared.common.deleteUserValues(['whitelisted', 'whitelistedDate']);
			}
			syncer.progressBar.setMessage('Syncing your whitelist...');
			await syncWhitelistBlacklist(
				'whitelisted',
				syncer,
				`https://www.steamgifts.com/account/manage/whitelist/search?page=`
			);
			if (!syncer.canceled) {
				await Shared.common.setSetting('lastPageWhitelist', 0);
			}
		}

		if (syncer.canceled) {
			return;
		}

		if (
			(syncer.parameters && syncer.parameters.Blacklist) ||
			(!syncer.parameters && Settings.get('syncBlacklist'))
		) {
			if (Settings.get('lastPageBlacklist') === 0) {
				await Shared.common.deleteUserValues(['blacklisted', 'blacklistedDate']);
			}
			syncer.progressBar.setMessage('Syncing your blacklist...');
			await syncWhitelistBlacklist(
				'blacklisted',
				syncer,
				`https://www.steamgifts.com/account/manage/blacklist/search?page=`
			);
			if (!syncer.canceled) {
				await Shared.common.setSetting('lastPageBlacklist', 0);
			}
		}

		if (!syncer.canceled) {
			DOM.insert(syncer.results, 'beforeend', <div>Whitelist/blacklist synced.</div>);
		}
	}

	// if sync has been canceled stop
	if (syncer.canceled) {
		return;
	}

	// sync steam friends
	if (
		(syncer.parameters && syncer.parameters.SteamFriends) ||
		(!syncer.parameters && Settings.get('syncSteamFriends'))
	) {
		const isPermitted = await permissions.contains([['steamApi']]);
		if (isPermitted) {
			try {
				const users = [];
				syncer.progressBar.setMessage('Syncing your Steam friends...');
				await Shared.common.deleteUserValues(['steamFriend']);
				const response = await FetchRequest.get(
					`http://api.steampowered.com/ISteamUser/GetFriendList/v0001/?key=${Settings.get(
						'steamApiKey'
					)}&steamid=${Settings.get('steamId')}&relationship=friend`
				);
				for (const friend of response.json.friendslist.friends) {
					users.push({
						steamId: friend.steamid,
						values: {
							steamFriend: friend.friend_since,
						},
					});
				}
				syncer.progressBar.setMessage(`Saving your Steam friends (this may take a while)...`);
				await Shared.common.saveUsers(users);
				DOM.insert(syncer.results, 'beforeend', <div>Steam friends synced.</div>);
			} catch (e) {
				syncer.failed.SteamFriends = true;
				DOM.insert(
					syncer.results,
					'beforeend',
					<div>
						Failed to sync your Steam friends. Check if you have a valid Steam API key set or if
						your profile is public.
					</div>
				);
			}
		} else {
			syncer.failed.SteamFriends = true;
			DOM.insert(syncer.results, 'beforeend', <div>{permissions.getMessage([['steamApi']])}</div>);
		}
	}

	// if sync has been canceled stop
	if (syncer.canceled) {
		return;
	}

	// sync hidden games
	if (
		((syncer.parameters && syncer.parameters.HiddenGames) ||
			(!syncer.parameters && Settings.get('syncHiddenGames'))) &&
		(now - Settings.get('lastSyncHiddenGames') > 2592000000 ||
			Settings.get('lastPageHiddenGames') > 0)
	) {
		syncer.progressBar.setMessage('Syncing your hidden games...');
		if (Settings.get('lastPageHiddenGames') === 0) {
			const lock = new Lock('game', { threshold: 300 });
			await lock.lock();
			let savedGames = JSON.parse(Shared.common.getValue('games'));
			for (let key in savedGames.apps) {
				if (savedGames.apps.hasOwnProperty(key)) {
					delete savedGames.apps[key].hidden;
				}
			}
			for (let key in savedGames.subs) {
				if (savedGames.subs.hasOwnProperty(key)) {
					delete savedGames.subs[key].hidden;
				}
			}
			await Shared.common.setValue('games', JSON.stringify(savedGames));
			await lock.unlock();
		}
		let nextPage =
			Settings.get('lastPageHiddenGames') > 0 ? Settings.get('lastPageHiddenGames') : 1;
		let pagination = null;
		do {
			const hiddenGames = {
				apps: [],
				subs: [],
			};
			let elements, responseHtml;
			syncer.progressBar.setMessage(`Syncing your hidden games (page ${nextPage})...`);
			responseHtml = (
				await FetchRequest.get(
					`https://www.steamgifts.com/account/settings/giveaways/filters/search?page=${nextPage}`,
					{ queue: true }
				)
			).html;
			elements = responseHtml.querySelectorAll(
				`.table__column__secondary-link[href*="store.steampowered.com"]`
			);
			for (let i = 0, n = elements.length; i < n; ++i) {
				let match = elements[i].getAttribute('href').match(/(app|sub)\/(\d+)/);
				if (match) {
					hiddenGames[`${match[1]}s`].push(match[2]);
				}
			}
			pagination = responseHtml.getElementsByClassName('pagination__navigation')[0];
			nextPage += 1;
			const lock = new Lock('game', { threshold: 300 });
			await lock.lock();
			let savedGames = JSON.parse(Shared.common.getValue('games'));
			for (let i = 0, n = hiddenGames.apps.length; i < n; ++i) {
				if (!savedGames.apps[hiddenGames.apps[i]]) {
					savedGames.apps[hiddenGames.apps[i]] = {};
				}
				savedGames.apps[hiddenGames.apps[i]].hidden = true;
			}
			for (let i = 0, n = hiddenGames.subs.length; i < n; ++i) {
				if (!savedGames.subs[hiddenGames.subs[i]]) {
					savedGames.subs[hiddenGames.subs[i]] = {};
				}
				savedGames.subs[hiddenGames.subs[i]].hidden = true;
			}
			await Shared.common.setValue('games', JSON.stringify(savedGames));
			await lock.unlock();
			await Shared.common.setSetting('lastPageHiddenGames', nextPage);
		} while (
			!syncer.canceled &&
			pagination &&
			!pagination.lastElementChild.classList.contains('is-selected')
		);
		if (!syncer.canceled) {
			await Shared.common.setSetting('lastPageHiddenGames', 0);
			DOM.insert(syncer.results, 'beforeend', <div>Hidden games synced.</div>);
		}
	}

	// if sync has been canceled stop
	if (syncer.canceled) {
		return;
	}

	if (Settings.get('hgm_s')) {
		syncer.hgm = {
			toAdd: { apps: new Set(), subs: new Set() },
			toRemove: { apps: new Set(), subs: new Set() },
		};
	}

	// sync wishlisted/owned/ignored games
	if (
		(syncer.parameters && syncer.parameters.Games) ||
		(!syncer.parameters && Settings.get('syncGames'))
	) {
		const isPermitted = await permissions.contains([['steamApi'], ['steamStore']]);
		if (isPermitted) {
			syncer.progressBar.setMessage('Syncing your wishlisted/owned/ignored games...');
			try {
				syncer.jsx = [];
				let apiResponse = null;
				if (Settings.get('steamApiKey')) {
					apiResponse = await FetchRequest.get(
						`http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${Settings.get(
							'steamApiKey'
						)}&steamid=${Settings.get('steamId')}&format=json`
					);
				}
				let storeResponse = await FetchRequest.get(
					`http://store.steampowered.com/dynamicstore/userdata?${
						Math.random().toString().split('.')[1]
					}`
				);
				await syncGames(null, syncer, apiResponse, storeResponse);
				if (Settings.get('gc_o_a')) {
					const altAccounts = Settings.get('gc_o_altAccounts');
					if (altAccounts?.length > 0) {
						if (Settings.get('steamApiKey')) {
							for (const altAccount of altAccounts) {
								if (syncer.canceled) {
									break;
								}
								apiResponse = await FetchRequest.get(
									`http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${Settings.get(
										'steamApiKey'
									)}&steamid=${altAccount.steamId}&format=json`
								);
								await syncGames(altAccount, syncer, apiResponse);
							}
							await Shared.common.setSetting('gc_o_altAccounts', altAccounts);
						} else {
							syncer.jsx.push(
								<div>
									Failed to sync your owned games from alt accounts. Check if you have a valid Steam
									API key set in the settings menu.
								</div>
							);
						}
					}
				}
				DOM.insert(
					syncer.results,
					'beforeend',
					<fragment>
						<div>Owned/wishlisted/ignored games synced.</div>
						{syncer.jsx}
					</fragment>
				);
				if (Settings.get('getSyncGameNames')) {
					// noinspection JSIgnoredPromiseFromCall
					Shared.common.getGameNames(syncer.results);
				}
			} catch (e) {
				syncer.failed.Games = true;
				DOM.insert(
					syncer.results,
					'beforeend',
					<div>Failed to sync your owned / wishlisted / ignored games. Try again later.</div>
				);
			}
		} else {
			syncer.failed.Games = true;
			DOM.insert(
				syncer.results,
				'beforeend',
				<div>{permissions.getMessage([['steamApi'], ['steamStore']])}</div>
			);
		}
	}

	// if sync has been canceled stop
	if (syncer.canceled) {
		return;
	}

	// sync followed games
	if (
		(syncer.parameters && syncer.parameters.FollowedGames) ||
		(!syncer.parameters && Settings.get('syncFollowedGames'))
	) {
		const isPermitted = await permissions.contains([['steamCommunity']]);
		if (isPermitted) {
			syncer.progressBar.setMessage('Syncing your followed games...');
			const response = await FetchRequest.get('https://steamcommunity.com/my/followedgames/');
			const elements = response.html.querySelectorAll('.gameListRow.followed');
			const savedGames = JSON.parse(Shared.common.getValue('games'));
			for (const id in savedGames.apps) {
				if (savedGames.apps.hasOwnProperty(id)) {
					savedGames.apps[id].followed = null;
				}
			}
			for (const element of elements) {
				const id = parseInt(element.getAttribute('data-appid'));
				if (!savedGames.apps[id]) {
					savedGames.apps[id] = {};
				}
				savedGames.apps[id].followed = true;
			}
			await Shared.common.lockAndSaveGames(savedGames);
			DOM.insert(syncer.results, 'beforeend', <div>Followed games synced.</div>);
		} else {
			syncer.failed.FollowedGames = true;
			DOM.insert(
				syncer.results,
				'beforeend',
				<div>{permissions.getMessage([['steamCommunity']])}</div>
			);
		}
	}

	// if sync has been canceled stop
	if (syncer.canceled) {
		return;
	}

	// sync won games
	if (
		(syncer.parameters && syncer.parameters.WonGames) ||
		(!syncer.parameters && Settings.get('syncWonGames'))
	) {
		syncer.progressBar.setMessage('Syncing your won games...');
		await Shared.common.getWonGames(syncer);
		DOM.insert(syncer.results, 'beforeend', <div>Won games synced.</div>);
	}

	// if sync has been canceled stop
	if (syncer.canceled) {
		return;
	}

	// sync reduced cv games
	if (
		(syncer.parameters && syncer.parameters.ReducedCvGames) ||
		(!syncer.parameters && Settings.get('syncReducedCvGames'))
	) {
		const isPermitted = await permissions.contains([['server']]);
		if (isPermitted) {
			syncer.progressBar.setMessage('Syncing reduced CV games...');
			try {
				await syncReducedCvGames();
				DOM.insert(
					syncer.results,
					'beforeend',
					<div>
						<i className="fa fa-check"></i> Reduced CV games synced.
					</div>
				);
			} catch (e) {
				Logger.warning(e.message);
				syncer.failed.ReducedCvGames = true;
				DOM.insert(
					syncer.results,
					'beforeend',
					<div>
						<i className="fa fa-times"></i> Failed to sync reduced CV games.
					</div>
				);
			}
		} else {
			syncer.failed.ReducedCvGames = true;
			DOM.insert(
				syncer.results,
				'beforeend',
				<div>
					<i className="fa fa-times"></i> {permissions.getMessage([['server']])}
				</div>
			);
		}
	}

	// if sync has been canceled stop
	if (syncer.canceled) {
		return;
	}

	// sync no cv games
	if (
		(syncer.parameters && syncer.parameters.NoCvGames) ||
		(!syncer.parameters && Settings.get('syncNoCvGames'))
	) {
		const isPermitted = await permissions.contains([['server']]);
		if (isPermitted) {
			syncer.progressBar.setMessage('Syncing no CV games...');
			try {
				await syncNoCvGames();
				DOM.insert(
					syncer.results,
					'beforeend',
					<div>
						<i className="fa fa-check"></i> No CV games synced.
					</div>
				);
			} catch (e) {
				Logger.warning(e.message);
				syncer.failed.NoCvGames = true;
				DOM.insert(
					syncer.results,
					'beforeend',
					<div>
						<i className="fa fa-times"></i> Failed to sync no CV games.
					</div>
				);
			}
		} else {
			syncer.failed.NoCvGames = true;
			DOM.insert(
				syncer.results,
				'beforeend',
				<div>
					<i className="fa fa-times"></i> {permissions.getMessage([['server']])}
				</div>
			);
		}
	}

	// sync hltb times
	if (
		(syncer.parameters && syncer.parameters.HltbTimes) ||
		(!syncer.parameters && Settings.get('syncHltbTimes'))
	) {
		const isPermitted = await permissions.contains([['googleWebApp']]);
		if (isPermitted) {
			syncer.progressBar.setMessage('Syncing HLTB times...');
			try {
				const games = (
					await FetchRequest.get(
						`https://script.google.com/macros/s/AKfycbysBF72c0VNylStaslLlOL7X4M0KQIgY0VVv6Q0x2vh72iGAtE/exec`
					)
				).json;
				const hltb = {};
				for (const game of games) {
					if (game.steamId) {
						hltb[game.steamId] = game;
					}
				}
				let cache = JSON.parse(
					LocalStorage.get(
						'gcCache',
						`{ "apps": {}, "subs": {}, "hltb": {}, "timestamp": 0, "version": 7 }`
					)
				);
				if (cache.version !== 7) {
					cache = {
						apps: {},
						subs: {},
						hltb: cache.hltb,
						timestamp: 0,
						version: 7,
					};
				}
				cache.hltb = hltb;
				LocalStorage.set('gcCache', JSON.stringify(cache));
			} catch (e) {
				Logger.warning(e.message, e.stack);
			}
			DOM.insert(syncer.results, 'beforeend', <div>HLTB times synced.</div>);
		} else {
			syncer.failed.HltbTimes = true;
			DOM.insert(
				syncer.results,
				'beforeend',
				<div>{permissions.getMessage([['googleWebApp']])}</div>
			);
		}
	}

	// if sync has been canceled stop
	if (syncer.canceled) {
		return;
	}

	// sync delisted games
	if (
		(syncer.parameters && syncer.parameters.DelistedGames) ||
		(!syncer.parameters && Settings.get('syncDelistedGames'))
	) {
		const isPermitted = await permissions.contains([['steamTracker']]);
		if (isPermitted) {
			syncer.progressBar.setMessage('Syncing delisted games...');
			const response = await FetchRequest.get('https://steam-tracker.com/api?action=GetAppListV3');
			try {
				if (response.json.success) {
					const banned = response.json.removed_apps
						.filter((x) => x.type === 'game' && x.category === 'Banned')
						.map((x) => parseInt(x.appid));
					const removed = response.json.removed_apps
						.filter((x) => x.type === 'game' && x.category === 'Delisted')
						.map((x) => parseInt(x.appid));
					await Shared.common.setValue('delistedGames', JSON.stringify({ banned, removed }));
					if (Settings.get('hgm_s')) {
						if (Settings.get('hgm_addBanned')) {
							for (const id of banned) {
								syncer.hgm.toAdd.apps.add(id);
							}
						} else if (Settings.get('hgm_removeBanned')) {
							for (const id of banned) {
								syncer.hgm.toRemove.apps.add(id);
							}
						}
					}
				}
				DOM.insert(syncer.results, 'beforeend', <div>Delisted games synced.</div>);
			} catch (error) {
				DOM.insert(
					syncer.results,
					'beforeend',
					<div>Failed to sync delisted games (check the console log for more info).</div>
				);
				Logger.warning(error.message, error.stack);
			}
		} else {
			syncer.failed.DelistedGames = true;
			DOM.insert(
				syncer.results,
				'beforeend',
				<div>{permissions.getMessage([['steamTracker']])}</div>
			);
		}
	}

	if (syncer.canceled) {
		return;
	}

	if (Settings.get('hgm_s')) {
		const result = await Shared.common.hideGames({
			appIds: syncer.hgm.toAdd.apps,
			subIds: syncer.hgm.toAdd.subs,
			update: (message) => syncer.progressBar.setMessage(message),
		});
		const tmpResult = await Shared.common.hideGames(
			{
				appIds: syncer.hgm.toRemove.apps,
				subIds: syncer.hgm.toRemove.subs,
				update: (message) => syncer.progressBar.setMessage(message),
			},
			true
		);
		result.apps = result.apps.concat(tmpResult.apps);
		result.subs = result.subs.concat(tmpResult.subs);
		let message = '';
		if (result.apps.length) {
			message += `The following apps were not found and therefore not hidden / unhidden (they are most likely internal apps, such as demos, game editors etc): ${result.apps.join(
				`, `
			)}\n`;
		}
		if (result.subs.length) {
			message += `The following subs were not found and therefore not hidden / unhidden: ${result.subs.join(
				`, `
			)}\n`;
		}
		if (message) {
			window.alert(message);
		}
	}

	if (syncer.canceled) {
		return;
	}

	// sync giveaways
	if (
		((syncer.parameters && syncer.parameters.Giveaways) ||
			(!syncer.parameters && Settings.get('syncGiveaways'))) &&
		Shared.esgst.sg
	) {
		syncer.progressBar.setMessage('Syncing your giveaways...');
		const key = 'sent';
		const user = {
			steamId: Settings.get('steamId'),
			username: Settings.get('username'),
		};
		syncer.process = await Shared.esgst.modules.usersUserGiveawayData.ugd_add(
			null,
			key,
			user,
			syncer
		);
		await syncer.process.start();
		DOM.insert(syncer.results, 'beforeend', <div>Giveaways synced.</div>);
	}

	// sync won giveaways
	if (
		((syncer.parameters && syncer.parameters.WonGiveaways) ||
			(!syncer.parameters && Settings.get('syncWonGiveaways'))) &&
		Shared.esgst.sg
	) {
		syncer.progressBar.setMessage('Syncing your won giveaways...');
		const key = 'won';
		const user = {
			steamId: Settings.get('steamId'),
			username: Settings.get('username'),
		};
		syncer.process = await Shared.esgst.modules.usersUserGiveawayData.ugd_add(
			null,
			key,
			user,
			syncer
		);
		await syncer.process.start();
		DOM.insert(syncer.results, 'beforeend', <div>Won giveaways synced.</div>);
	}

	// finish sync
	if (!Shared.esgst.isFirstRun) {
		syncer.progressBar.setMessage('Updating last sync date...');
		let keys = [
			'Groups',
			'Whitelist',
			'Blacklist',
			'SteamFriends',
			'HiddenGames',
			'Games',
			'FollowedGames',
			'WonGames',
			'ReducedCvGames',
			'NoCvGames',
			'HltbTimes',
			'DelistedGames',
			'Giveaways',
			'WonGiveaways',
		];
		for (let i = keys.length - 1; i > -1; i--) {
			let key = keys[i];
			let id = `sync${key}`;
			if (
				!syncer.failed[key] &&
				((syncer.parameters && syncer.parameters[key]) || (!syncer.parameters && Settings.get(id)))
			) {
				Settings.set(`lastSync${key}`, now);
				toSave[`lastSync${key}`] = now;
			}
		}
		await Shared.common.lockAndSaveSettings(toSave);
		toSave = {};
		syncer.progressBar.setSuccess('Synced!');
		LocalStorage.delete('isSyncing');
	}
	if (!syncer.isSilent) {
		updateSyncDates(syncer);
	}
}

async function syncReducedCvGames() {
	const response = await FetchRequest.get('https://esgst.rafaelgomes.xyz/api/games/rcv');
	const games = response.json.result.found;
	for (const id in games.apps) {
		if (games.apps.hasOwnProperty(id)) {
			games.apps[id].reducedCV = Shared.common.dateFromServer(games.apps[id].effective_date);
			delete games.apps[id].effective_date;
		}
	}
	for (const id in games.subs) {
		if (games.subs.hasOwnProperty(id)) {
			games.subs[id].reducedCV = Shared.common.dateFromServer(games.subs[id].effective_date);
			delete games.subs[id].effective_date;
		}
	}
	for (const id in Shared.esgst.games.apps) {
		if (Shared.esgst.games.apps.hasOwnProperty(id) && !games.apps[id]) {
			games.apps[id] = {
				reducedCV: null,
			};
		}
	}
	for (const id in Shared.esgst.games.subs) {
		if (Shared.esgst.games.subs.hasOwnProperty(id) && !games.subs[id]) {
			games.subs[id] = {
				reducedCV: null,
			};
		}
	}
	await Shared.common.lockAndSaveGames(games);
}

async function syncNoCvGames() {
	const response = await FetchRequest.get('https://esgst.rafaelgomes.xyz/api/games/ncv');
	const games = response.json.result.found;
	for (const id in games.apps) {
		if (games.apps.hasOwnProperty(id)) {
			games.apps[id].noCV = Shared.common.dateFromServer(games.apps[id].effective_date);
			delete games.apps[id].effective_date;
		}
	}
	for (const id in games.subs) {
		if (games.subs.hasOwnProperty(id)) {
			games.subs[id].noCV = Shared.common.dateFromServer(games.subs[id].effective_date);
			delete games.subs[id].effective_date;
		}
	}
	for (const id in Shared.esgst.games.apps) {
		if (Shared.esgst.games.apps.hasOwnProperty(id) && !games.apps[id]) {
			games.apps[id] = {
				noCV: null,
			};
		}
	}
	for (const id in Shared.esgst.games.subs) {
		if (Shared.esgst.games.subs.hasOwnProperty(id) && !games.subs[id]) {
			games.subs[id] = {
				noCV: null,
			};
		}
	}
	await Shared.common.lockAndSaveGames(games);
}

async function syncWhitelistBlacklist(key, syncer, url) {
	const name = key === 'whitelisted' ? 'Whitelist' : 'Blacklist';
	let nextPage = Settings.get(`lastPage${key}`) > 0 ? Settings.get(`lastPage${key}`) : 1;
	let pagination = null;
	do {
		const users = [];
		let elements, responseHtml;
		syncer.progressBar.setMessage(`Syncing your ${name.toLowerCase()} (page ${nextPage})...`);
		responseHtml = (await FetchRequest.get(`${url}${nextPage}`, { queue: true })).html;
		elements = responseHtml.getElementsByClassName('table__row-outer-wrap');
		for (let i = 0, n = elements.length; i < n; ++i) {
			let element, user;
			element = elements[i];
			user = {
				id: element.querySelector(`[name="child_user_id"]`).value,
				username: element.getElementsByClassName('table__column__heading')[0].textContent,
				values: {},
			};
			user.values[key] = true;
			user.values[`${key}Date`] =
				parseInt(element.querySelector(`[data-timestamp]`).getAttribute('data-timestamp')) * 1e3;
			users.push(user);
		}
		pagination = responseHtml.getElementsByClassName('pagination__navigation')[0];
		nextPage += 1;
		await Shared.common.saveUsers(users);
		await Shared.common.setSetting(`lastPage${key}`, nextPage);
	} while (
		!syncer.canceled &&
		pagination &&
		!pagination.lastElementChild.classList.contains('is-selected')
	);
}

async function syncGames(altAccount, syncer, apiResponse, storeResponse) {
	const apiJson = apiResponse && apiResponse.json;
	const storeJson = storeResponse && storeResponse.json;
	/** @property storeJson.rgOwnedApps */
	const hasApi =
			apiJson && apiJson.response && apiJson.response.games && apiJson.response.games.length,
		hasStore = storeJson && storeJson.rgOwnedApps && storeJson.rgOwnedApps.length;
	if (
		((altAccount && !Settings.get('steamApiKey')) ||
			(!altAccount && Settings.get('steamApiKey'))) &&
		!hasApi
	) {
		syncer.jsx.push(
			<div>
				{altAccount ? <span className="esgst-bold">{`${altAccount.name}: `}</span> : null}
				Unable to sync through the Steam API. Check if you have a valid Steam API key set in the
				settings menu.
				{altAccount ? 'Also check the privacy settings of your alt account.' : null}
			</div>
		);
	}
	if (!altAccount && !hasStore) {
		syncer.jsx.push(
			'Unable to sync through the Steam store. Check if you are logged in to Steam on your current browser session. If you are, try again later. Some games may not be available through the Steam API (if you have a Steam API key set).'
		);
	}
	//Logger.info(hasApi, hasStore);
	if ((!hasApi || !Settings.get('fallbackSteamApi')) && !hasStore) {
		return;
	}

	// delete old data
	const savedGames =
		(altAccount && altAccount.games) || JSON.parse(Shared.common.getValue('games'));
	const oldWishlisted = {
		apps: [],
		subs: [],
	};
	const oldIgnored = {
		apps: [],
		subs: [],
	};
	const oldOwned = {
		apps: [],
		subs: [],
	};
	for (const id in savedGames.apps) {
		if (savedGames.apps.hasOwnProperty(id)) {
			if (savedGames.apps[id].owned) {
				oldOwned.apps.push(id);
				savedGames.apps[id].owned = null;
			}
			if (hasStore) {
				if (savedGames.apps[id].wishlisted) {
					oldWishlisted.apps.push(id);
					savedGames.apps[id].wishlisted = null;
				}
				if (savedGames.apps[id].ignored) {
					oldIgnored.apps.push(id);
					savedGames.apps[id].ignored = null;
				}
			}
		}
	}
	if (hasStore) {
		for (const id in savedGames.subs) {
			if (savedGames.subs.hasOwnProperty(id)) {
				if (savedGames.subs[id].owned) {
					oldOwned.subs.push(id);
					savedGames.subs[id].owned = null;
				}
				if (savedGames.subs[id].wishlisted) {
					oldWishlisted.subs.push(id);
					savedGames.subs[id].wishlisted = null;
				}
				if (savedGames.subs[id].ignored) {
					oldIgnored.subs.push(id);
					savedGames.subs[id].ignored = null;
				}
			}
		}
	}

	// add new data
	const newWishlisted = {
		apps: [],
		subs: [],
	};
	const newIgnored = {
		apps: [],
		subs: [],
	};
	const newOwned = {
		apps: [],
		subs: [],
	};
	let numOwned = 0;
	if (hasApi) {
		apiJson.response.games.forEach((game) => {
			const id = game.appid;
			if (!savedGames.apps[id]) {
				savedGames.apps[id] = {};
			}
			savedGames.apps[id].owned = true;
			newOwned.apps.push(id.toString());
			numOwned += 1;
		});
	}
	if (!altAccount) {
		if (hasStore) {
			[
				{
					jsonKey: 'rgWishlist',
					key: 'wishlisted',
					type: 'apps',
				},
				{
					jsonKey: 'rgOwnedApps',
					key: 'owned',
					type: 'apps',
				},
				{
					jsonKey: 'rgOwnedPackages',
					key: 'owned',
					type: 'subs',
				},
				{
					jsonKey: 'rgIgnoredApps',
					key: 'ignored',
					type: 'apps',
				},
				{
					jsonKey: 'rgIgnoredPackages',
					key: 'ignored',
					type: 'subs',
				},
			].forEach((item) => {
				const jsonKey = item.jsonKey;
				const key = item.key;
				const type = item.type;
				let ids = [];
				if (Array.isArray(storeJson[jsonKey])) {
					ids = storeJson[jsonKey];
				} else {
					ids = Object.keys(storeJson[jsonKey]);
				}
				for (const id of ids) {
					if (!savedGames[type][id]) {
						savedGames[type][id] = {};
					}
					const value = savedGames[type][id][key];
					savedGames[type][id][key] = true;
					if (key === 'owned' && !value) {
						newOwned[type].push(id.toString());
						numOwned += 1;
					} else if (key === 'wishlisted') {
						newWishlisted[type].push(id.toString());
					} else if (key === 'ignored') {
						newIgnored[type].push(id.toString());
					}
				}
			});
		}

		if (numOwned !== Shared.common.getValue('ownedGames', 0)) {
			await Shared.common.setValue('ownedGames', numOwned);
		}

		// get the wishlisted dates
		try {
			const response = await FetchRequest.get(
				`http://store.steampowered.com/wishlist/profiles/${Settings.get('steamId')}?cc=us&l=english`
			);
			const match = response.text.match(/g_rgWishlistData\s=\s(\[(.+?)]);/);
			if (match) {
				JSON.parse(match[1]).forEach((item) => {
					/**
					 * @property {string} item.appid
					 * @property {boolean} item.added
					 */
					const id = item.appid;
					if (!savedGames.apps[id]) {
						savedGames.apps[id] = {};
					}
					savedGames.apps[id].wishlisted = item.added;
				});
			}
		} catch (e) {
			/**/
		}
	}

	const removedOwned = {};
	const addedOwned = {};
	const removedWishlisted = {};
	const addedWishlisted = {};
	const removedIgnored = {};
	const addedIgnored = {};
	for (const type of ['apps', 'subs']) {
		removedOwned[type] = oldOwned[type].filter((x) => newOwned[type].indexOf(x) < 0);
		addedOwned[type] = newOwned[type].filter((x) => oldOwned[type].indexOf(x) < 0);
		removedWishlisted[type] = oldWishlisted[type].filter((x) => newWishlisted[type].indexOf(x) < 0);
		addedWishlisted[type] = newWishlisted[type].filter((x) => oldWishlisted[type].indexOf(x) < 0);
		removedIgnored[type] = oldIgnored[type].filter((x) => newIgnored[type].indexOf(x) < 0);
		addedIgnored[type] = newIgnored[type].filter((x) => oldIgnored[type].indexOf(x) < 0);
		if (Settings.get('hgm_s')) {
			if (Settings.get('hgm_addOwned')) {
				for (const id of addedOwned[type]) {
					syncer.hgm.toAdd[type].add(id);
				}
				for (const id of removedOwned[type]) {
					syncer.hgm.toRemove[type].add(id);
				}
			} else if (Settings.get('hgm_removeOwned')) {
				for (const id of addedOwned[type]) {
					syncer.hgm.toRemove[type].add(id);
				}
			}
			if (Settings.get('hgm_removeWishlisted')) {
				for (const id of addedWishlisted[type]) {
					syncer.hgm.toRemove[type].add(id);
				}
			}
			if (Settings.get('hgm_addIgnored')) {
				for (const id of addedIgnored[type]) {
					syncer.hgm.toAdd[type].add(id);
				}
				for (const id of removedIgnored[type]) {
					syncer.hgm.toRemove[type].add(id);
				}
			}
		}
		console.log(removedWishlisted);
		if (!altAccount) {
			for (const id of removedWishlisted[type]) {
				savedGames[type][id].previouslyWishlisted = true;
			}
		}
	}
	if (!altAccount) {
		await Shared.common.lockAndSaveGames(savedGames);
	}
	if (
		altAccount &&
		(removedOwned.apps.length > 0 ||
			removedOwned.subs.length > 0 ||
			addedOwned.apps.length > 0 ||
			addedOwned.subs.length > 0)
	) {
		syncer.jsx.push(
			<br />,
			<div className="esgst-bold">{`Alt Account - ${altAccount.name}`}</div>,
			<br />
		);
	}
	if (removedOwned.apps.length > 0) {
		syncer.jsx.push(
			<div>
				<span className="esgst-bold">Removed apps: </span>
				{removedOwned.apps
					.map((x, i) => {
						x = <a href={`http://store.steampowered.com/app/${x}`}>{x}</a>;
						return i < removedOwned.apps.length - 1 ? [x, ', '] : [x];
					})
					.flat()}
			</div>
		);
	}
	if (removedOwned.subs.length > 0) {
		syncer.jsx.push(
			<div>
				<span className="esgst-bold">Removed packages: </span>
				{removedOwned.subs
					.map((x, i) => {
						x = <a href={`http://store.steampowered.com/sub/${x}`}>{x}</a>;
						return i < removedOwned.subs.length - 1 ? [x, ', '] : [x];
					})
					.flat()}
			</div>
		);
	}
	if (addedOwned.apps.length > 0) {
		syncer.jsx.push(
			<div>
				<span className="esgst-bold">Added apps: </span>
				{addedOwned.apps
					.map((x, i) => {
						x = <a href={`http://store.steampowered.com/app/${x}`}>{x}</a>;
						return i < addedOwned.apps.length - 1 ? [x, ', '] : [x];
					})
					.flat()}
			</div>
		);
	}
	if (addedOwned.subs.length > 0) {
		syncer.jsx.push(
			<div>
				<span className="esgst-bold">Added packages: </span>
				{addedOwned.subs
					.map((x, i) => {
						x = <a href={`http://store.steampowered.com/sub/${x}`}>{x}</a>;
						return i < addedOwned.subs.length - 1 ? [x, ', '] : [x];
					})
					.flat()}
			</div>
		);
	}
}

export { runSilentSync, setSync, SYNC_KEYS };
