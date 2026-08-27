import JSZip from '@progress/jszip-esm';
import { RequestQueue } from './class/Queue';

const lastRequests = {};
const loggedOutRequests = new Map();
const activeLoggedOutWebRequests = new Set();
let nextLoggedOutRequestId = 0;
let cfChallengePromise = null;

RequestQueue.getLastRequest = (key) => {
	return lastRequests[key] ?? 0;
};

RequestQueue.setLastRequest = (key, lastRequest) => {
	lastRequests[key] = lastRequest;
};

RequestQueue.getRequestThresholds = async () => {
	const values = await browser.storage.local.get('settings');
	const settings = values.settings ? JSON.parse(values.settings) : {};
	if (settings['useCustomAdaReqLim_sg']?.enabled) {
		const thresholds = {};
		for (const [key, minThreshold] of Object.entries(RequestQueue.queue.sg.minThresholds)) {
			thresholds[key] = parseFloat(settings[`customAdaReqLim_${key}`] ?? 0.0);
			if (thresholds[key] < minThreshold) {
				thresholds[key] = minThreshold;
			}
		}
		return thresholds;
	} else {
		return { ...RequestQueue.queue.sg.minThresholds };
	}
};

RequestQueue.getRequestLog = async () => {
	const values = await browser.storage.local.get('requestLog');
	return JSON.parse(values.requestLog);
};

RequestQueue.init();

/**
 * @typedef {Object} OpenTab
 * @property {number} id
 * @property {string} url
 */

/** @type {OpenTab[]} */
let openTabs = [];
let storage = {};
let browserInfo = null;
let hasAddedWebRequestListener = false;

if (browser.webRequest) {
	addWebRequestListener();
}

// getBrowserInfo must be removed from webextension-polyfill/browser-polyfill.min.js for this to work on Chrome
if ('getBrowserInfo' in browser.runtime) {
	browser.runtime.getBrowserInfo().then((result) => (browserInfo = result));
} else {
	browserInfo = { name: '?' };
}

const loadStorage = () => browser.storage.local.get(null).then((result) => (storage = result));

loadStorage().then(async () => {
	/**
	 * @type {object}
	 * @property {boolean} activateTab_sg
	 * @property {boolean} activateTab_st
	 */
	const settings = storage.settings ? JSON.parse(storage.settings) : {};
	if (settings.activateTab_sg || settings.activateTab_st) {
		// Get the currently active tab.
		const currentTab = (await queryTabs({ active: true }))[0];
		if (settings.activateTab_sg) {
			// Set the SG tab as active.
			await activateTab('https://www.steamgifts.com');
		}
		if (settings.activateTab_st) {
			// Set the ST tab as active.
			await activateTab('https://www.steamtrades.com');
		}
		// Go back to the previously active tab.
		if (currentTab && currentTab.id) {
			await updateTab(currentTab.id, { active: true });
		}
	}
	await scheduleUpdateChecks(settings);
});

function isNewerVersion(candidate, current) {
	const candidateParts = candidate.split('.').map(Number);
	const currentParts = current.split('.').map(Number);
	for (let i = 0; i < Math.max(candidateParts.length, currentParts.length); i += 1) {
		const candidatePart = candidateParts[i] || 0;
		const currentPart = currentParts[i] || 0;
		if (candidatePart > currentPart) return true;
		if (candidatePart < currentPart) return false;
	}
	return false;
}

function getUpdateUrls(settings) {
	const urls = [];
	if (settings.notifyNewVersion_sg) urls.push('https://www.steamgifts.com');
	if (settings.notifyNewVersion_st) urls.push('https://www.steamtrades.com');
	return urls;
}

async function scheduleUpdateChecks(settings) {
	if (!settings.notifyNewVersion_sg && !settings.notifyNewVersion_st) {
		await browser.alarms.clear('checkUpdates');
		return;
	}
	const periodInMinutes = Math.max(1, Number(settings.updateCheckInterval) || 7) * 24 * 60;
	const existing = await browser.alarms.get('checkUpdates');
	if (!existing || existing.periodInMinutes !== periodInMinutes) {
		await browser.alarms.clear('checkUpdates');
		await browser.alarms.create('checkUpdates', { periodInMinutes });
	}
}

async function checkRemoteVersion() {
	try {
		const response = await fetch('https://api.github.com/repos/SquishedPotatoe/esgst/tags?per_page=100');
		if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
		const versions = (await response.json())
			.map((tag) => /^v(\d+\.\d+\.\d+)$/.exec(tag.name))
			.filter(Boolean)
			.map((match) => match[1]);
		const latestVersion = versions.reduce(
			(latest, version) => (!latest || isNewerVersion(version, latest) ? version : latest),
			null
		);
		const currentVersion = browser.runtime.getManifest().version;
		return { currentVersion, latestVersion, isNewVersion: !!latestVersion && isNewerVersion(latestVersion, currentVersion) };
	} catch (error) {
		console.warn('[ESGST] Update check failed', error);
		return { currentVersion: browser.runtime.getManifest().version, latestVersion: null, isNewVersion: false };
	}
}

async function sendUpdateMessage(tabId, action, values) {
	try {
		await browser.tabs.sendMessage(tabId, JSON.stringify({ action, values }));
	} catch (error) {
		console.warn('[ESGST] Failed to send update notification', error);
	}
}

async function notifyAboutUpdate(currentVersion, latestVersion) {
	const { settings: settingsValue = '{}', updateCheckState = {} } = await browser.storage.local.get(['settings', 'updateCheckState']);
	const settings = JSON.parse(settingsValue);
	if (updateCheckState.lastNotifiedVersion === latestVersion) return;
	const state = { ...updateCheckState, lastNotifiedVersion: latestVersion };
	const matchingTabs = openTabs.filter((tab) => getUpdateUrls(settings).some((url) => tab.url.startsWith(url)));
	if (matchingTabs.length) {
		await Promise.all(matchingTabs.map((tab) => sendUpdateMessage(tab.id, 'showUpdatePopup', { currentVersion, latestVersion })));
		delete state.pendingUpdateNotification;
	} else {
		state.pendingUpdateNotification = latestVersion;
	}
	await browser.storage.local.set({ updateCheckState: state });
}

async function deliverPendingUpdate(tab) {
	const { updateCheckState = {} } = await browser.storage.local.get('updateCheckState');
	if (!updateCheckState.pendingUpdateNotification) return;
	await sendUpdateMessage(tab.id, 'showUpdatePopup', {
		currentVersion: browser.runtime.getManifest().version,
		latestVersion: updateCheckState.pendingUpdateNotification,
	});
	delete updateCheckState.pendingUpdateNotification;
	await browser.storage.local.set({ updateCheckState });
}

browser.alarms.onAlarm.addListener(async (alarm) => {
	if (alarm.name !== 'checkUpdates') return;
	const { currentVersion, latestVersion, isNewVersion } = await checkRemoteVersion();
	if (isNewVersion) await notifyAboutUpdate(currentVersion, latestVersion);
});

browser.storage.onChanged.addListener((changes, areaName) => {
	if (areaName !== 'local' || !changes.settings) return;
	// noinspection JSIgnoredPromiseFromCall
	scheduleUpdateChecks(JSON.parse(changes.settings.newValue || '{}'));
});

browser.tabs.onRemoved.addListener(async (tabId) => {
	openTabs = openTabs.filter((tab) => tab.id !== tabId);
});

function isLoggedOutRequest(details) {
	if (activeLoggedOutWebRequests.has(details.requestId)) {
		return true;
	}

	const matched = Array.from(loggedOutRequests.values()).some((request) => {
		return (
			(details.url === request.url || details.url.startsWith(request.url)) &&
			(request.tabId === null || details.tabId === request.tabId)
		);
	});

	if (matched) {
		activeLoggedOutWebRequests.add(details.requestId);
	}

	return matched;
}

function addWebRequestListener() {
	hasAddedWebRequestListener = true;

	const webRequestFilters = {
		types: ['xmlhttprequest'],
		urls: [
			'*://*.steamgifts.com/*',
			'*://*.steamtrades.com/*',
			'*://*.sgtools.info/*',
			'*://*.steamcommunity.com/*',
			'*://*.store.steampowered.com/*',
		],
	};

	const optionsSend = ['blocking', 'requestHeaders'];
	const optionsReceive = ['blocking', 'responseHeaders'];

	if (browser.webRequest.OnBeforeSendHeadersOptions?.hasOwnProperty('EXTRA_HEADERS')) {
		optionsSend.push('extraHeaders');
	}
	if (browser.webRequest.OnHeadersReceivedOptions?.hasOwnProperty('EXTRA_HEADERS')) {
		optionsReceive.push('extraHeaders');
	}

	browser.webRequest.onCompleted.addListener(
		(details) => activeLoggedOutWebRequests.delete(details.requestId),
		webRequestFilters
	);

	browser.webRequest.onErrorOccurred.addListener(
		(details) => activeLoggedOutWebRequests.delete(details.requestId),
		webRequestFilters
	);

	browser.webRequest.onBeforeSendHeaders.addListener(
		(details) => {
			let headersModified = false;
			let requestHeaders = details.requestHeaders;

			if (isLoggedOutRequest(details)) {
				requestHeaders = requestHeaders.filter((header) => {
					if (header.name.toLowerCase() === 'cookie') {
						const filteredCookies = header.value
							.split(/;\s*/)
							.filter((c) => {
								const lower = c.trim().toLowerCase();
								return !lower.startsWith('phpsessid=');
							});

						if (filteredCookies.length > 0) {
							header.value = filteredCookies.join('; ');
							return true;
						}
						return false;
					}
					return true;
				});
				headersModified = true;
			}
			const esgstCookieIndex = requestHeaders.findIndex(
				(header) => header.name.toLowerCase() === 'esgst-cookie'
			);

			if (esgstCookieIndex !== -1) {
				requestHeaders = requestHeaders.filter(
					(header) => header.name.toLowerCase() !== 'cookie'
				);
				requestHeaders[esgstCookieIndex].name = 'Cookie';
				headersModified = true;
			}

			if (headersModified) {
				return { requestHeaders };
			}
		},
		webRequestFilters,
		optionsSend
	);

	browser.webRequest.onHeadersReceived.addListener(
		(details) => {
			if (isLoggedOutRequest(details)) {
				const responseHeaders = details.responseHeaders.filter(
					(header) => header.name.toLowerCase() !== 'set-cookie'
				);
				return { responseHeaders };
			}
		},
		webRequestFilters,
		optionsReceive
	);
}

async function sendMessage(action, sender, values, sendToAll) {
	for (const tab of openTabs) {
		if (sender && tab.id === sender.tab.id) {
			continue;
		}
		await browser.tabs.sendMessage(
			tab.id,
			JSON.stringify({
				action: action,
				values: values,
			})
		);
		if (!sender && !sendToAll) {
			return;
		}
	}
}

async function getZip(data, fileName) {
	const zip = new JSZip();
	zip.file(fileName, data);
	return await zip.generateAsync({
		compression: 'DEFLATE',
		compressionOptions: {
			level: 9,
		},
		type: 'blob',
	});
}

async function readZip(data) {
	const zip = new JSZip(),
		/** @property {Object} files */
		contents = await zip.loadAsync(data),
		keys = Object.keys(contents.files),
		output = [];
	for (const key of keys) {
		output.push({
			name: key,
			value: await zip.file(key).async('text'),
		});
	}
	return output;
}

async function doFetch(parameters, request, sender, callback) {
	const isSgTools = request.url.includes('www.sgtools.info');
	const isSgToolsAuth = request.url.includes('/api/v1/auth/refresh') || request.url.includes('/api/v1/auth/me');

	if (request.fileName) {
		parameters.body = await getZip(parameters.body, request.fileName);
	}

	const canReadCookies = await browser.permissions.contains({ permissions: ['cookies'] });

	if (request.manipulateCookies && canReadCookies && sender?.tab?.id) {
		try {
			let esgstCookie = parameters.headers.get('Esgst-Cookie') || '';
			const domain = request.url.match(/https?:\/\/(.+?)(\/.*)?$/)[1];
			const tab = await browser.tabs.get(sender.tab.id);
			const cookies = await browser.cookies.getAll({
				domain,
				storeId: tab.cookieStoreId,
				firstPartyDomain: null,
			});

			for (const cookie of cookies) {
				esgstCookie += `${cookie.name}=${cookie.value}; `;
			}

			parameters.headers.append('Esgst-Cookie', esgstCookie);
		} catch (e) {
			console.warn('[doFetch] Container cookie manipulation failed', e);
		}
	}

	const applySgToolsCsrfHeader = async () => {
		if (!isSgTools || !canReadCookies) return;

		const hasCsrf = parameters.headers.has('X-CSRF-Token') || parameters.headers.has('X-CSRF-TOKEN');
		if (hasCsrf) return;

		const csrfCookie = await browser.cookies.get({ url: request.url, name: 'sgt_csrf' });
		if (csrfCookie?.value) {
			try {
				parameters.headers.set('X-CSRF-Token', decodeURIComponent(csrfCookie.value));
			} catch (e) {
				console.warn('[doFetch] Could not decode SGTools CSRF cookie', e);
			}
		}
	};

	const fetchWithTimeout = async (url, fetchParameters) => {
		const abortController = new AbortController();
		const timeoutId = window.setTimeout(() => abortController.abort(), request.timeout || 10000);
		try {
			return await window.fetch(url, { ...fetchParameters, signal: abortController.signal });
		} finally {
			window.clearTimeout(timeoutId);
		}
	};

	let response = null;
	let responseText = null;
	try {
		await applySgToolsCsrfHeader();
		response = await fetchWithTimeout(request.url, parameters);

		if (isSgTools && !isSgToolsAuth && (response.status === 401 || response.status === 419)) {
			const refreshUrl = new URL('/api/v1/auth/refresh', request.url).href;
			const refreshRes = await fetchWithTimeout(refreshUrl, { method: 'POST', credentials: 'include' });
			if (refreshRes.ok) {
				await applySgToolsCsrfHeader();
				response = await fetchWithTimeout(request.url, parameters);
			}
		}

		const requestHost = new URL(request.url).hostname;
		const isSgStRequest =
			requestHost.endsWith('.steamgifts.com') || requestHost.endsWith('.steamtrades.com');
		const isCfBlocked =
			(response.status === 403 || response.status === 503) &&
			(response.headers.get('server')?.toLowerCase().includes('cloudflare') || isSgStRequest);

		if (isCfBlocked && (await resolveCloudflareChallenge(request.url))) {
			response = await fetchWithTimeout(request.url, parameters);
		}

		responseText = request.blob
			? (await readZip(await response.blob()))[0].value
			: await response.text();
		if (!response.ok) {
			throw responseText;
		}
	} catch (error) {
		callback(JSON.stringify({ error: error.message || error }));
		return;
	}
	callback(
		JSON.stringify({
			status: response.status,
			url: response.url,
			redirected: response.redirected,
			text: responseText,
		})
	);
}

async function resolveCloudflareChallenge(targetUrl) {
	if (cfChallengePromise) return cfChallengePromise;

	cfChallengePromise = (async () => {
		try {
			const urlObj = new URL(targetUrl);
			const domain = urlObj.hostname.replace(/^www\./, '');

			return await new Promise((resolve) => {
				let tempTabId = null;
				let timeoutId = null;

				const cleanup = () => {
					if (timeoutId) clearTimeout(timeoutId);
					browser.cookies.onChanged.removeListener(cookieListener);
					cfChallengePromise = null;
				};

				const cookieListener = ({ cookie, removed }) => {
					if (!removed && cookie.name === 'cf_clearance' && cookie.domain.includes(domain)) {
						cleanup();
						if (tempTabId) browser.tabs.remove(tempTabId).catch(() => {});
						resolve(true);
					}
				};

				browser.cookies.onChanged.addListener(cookieListener);
				timeoutId = setTimeout(() => {
					cleanup();
					resolve(false);
				}, 120000);

				(async () => {
					try {
						const tabs = await queryTabs({});
						const existing = tabs.find((tab) => tab.url && tab.url.includes(domain));

						if (existing?.id) {
							await browser.tabs.update(existing.id, { active: true });
							await browser.tabs.reload(existing.id);
						} else {
							const tab = await browser.tabs.create({
								url: `https://${urlObj.hostname}/`,
								active: true,
							});
							tempTabId = tab.id;
						}
					} catch (error) {
						console.error('[doFetch] Cloudflare challenge resolution failed', error);
						cleanup();
						resolve(false);
					}
				})();
			});
		} catch (error) {
			console.error('[doFetch] Cloudflare challenge resolution failed', error);
			cfChallengePromise = null;
			return false;
		}
	})();

	return cfChallengePromise;
}

const locks = {};

function do_lock(lock) {
	return new Promise((resolve) => {
		_do_lock(lock, resolve);
	});
}

function _do_lock(lock, resolve) {
	const now = Date.now();
	let locked = locks[lock.key];
	if (!locked || !locked.uuid || locked.timestamp < now - (lock.threshold + lock.timeout)) {
		locks[lock.key] = {
			timestamp: now,
			uuid: lock.uuid,
		};
		setTimeout(() => {
			locked = locks[lock.key];
			if (!locked || locked.uuid !== lock.uuid) {
				if (!lock.tryOnce) {
					setTimeout(() => _do_lock(lock, resolve), 0);
				} else {
					resolve('false');
				}
			} else {
				resolve('true');
			}
		}, lock.threshold / 2);
	} else if (!lock.tryOnce) {
		setTimeout(() => _do_lock(lock, resolve), lock.threshold / 3);
	} else {
		resolve('false');
	}
}

function update_lock(lock) {
	const locked = locks[lock.key];
	if (locked.uuid === lock.uuid) {
		locked.timestamp = Date.now();
	}
}

function do_unlock(lock) {
	if (locks[lock.key] && locks[lock.key].uuid === lock.uuid) {
		delete locks[lock.key];
	}
}

let tdsData = [];

browser.runtime.onMessage.addListener((request, sender) => {
	return new Promise(async (resolve) => {
		let parameters;
		switch (request.action) {
			case 'start_logged_out_fetch': {
				if (!hasAddedWebRequestListener && browser.webRequest) {
					addWebRequestListener();
				}
				const requestId = ++nextLoggedOutRequestId;
				loggedOutRequests.set(requestId, {
					url: request.url,
					tabId: typeof sender.tab?.id === 'number' ? sender.tab.id : null,
				});
				resolve({ success: true, requestId });
				break;
			}
			case 'end_logged_out_fetch': {
				loggedOutRequests.delete(request.requestId);
				resolve({ success: true });
				break;
			}
			case 'get-tds':
				({ tdsData = [] } = await browser.storage.local.get('tdsData'));
				resolve(JSON.stringify(tdsData));

				break;
			case 'notify-tds':
				tdsData = JSON.parse(request.data);
				await browser.storage.local.set({ tdsData });

				sendMessage('notify-tds', null, tdsData, true);

				resolve();

				break;
			case 'permissions_contains':
				resolve(await browser.permissions.contains(JSON.parse(request.permissions)));
				break;
			case 'getBrowserInfo':
				resolve(JSON.stringify(browserInfo));
				break;
			case 'queue_request':
				RequestQueue.enqueue(request.key).then(resolve);
				break;
			case 'do_lock':
				do_lock(JSON.parse(request.lock)).then(resolve);
				break;
			case 'update_lock':
				update_lock(JSON.parse(request.lock));
				resolve();
				break;
			case 'do_unlock':
				do_unlock(JSON.parse(request.lock));
				resolve();
				break;
			case 'fetch':
				if (!hasAddedWebRequestListener && browser.webRequest) {
					addWebRequestListener();
				}

				parameters = JSON.parse(request.parameters);
				parameters.headers = new Headers(parameters.headers);
				// noinspection JSIgnoredPromiseFromCall
				doFetch(parameters, request, sender, resolve);
				break;
			case 'reload':
				browser.runtime.reload();
				resolve();
				break;
			case 'tabs':
				// noinspection JSIgnoredPromiseFromCall
				getTabs(request);
				break;
			case 'open_tab':
				openTab(request.url);
				break;
			case 'register_tab': {
				const tab = {
					id: sender.tab.id,
					url: request.url,
				};
				openTabs = openTabs.filter((openTab) => openTab.id !== tab.id);
				openTabs.push(tab);
				await deliverPendingUpdate(tab);
				resolve();
				break;
			}
			case 'pendingUpdateCheck':
				if (sender.tab) await deliverPendingUpdate({ id: sender.tab.id, url: sender.tab.url });
				resolve();
				break;
			case 'manualCheckVersion': {
				const result = await checkRemoteVersion();
				if (sender.tab) {
					const action = result.isNewVersion ? 'showUpdatePopup' : result.latestVersion ? 'showUpToDatePopup' : 'showUpdateCheckFailed';
					await sendUpdateMessage(sender.tab.id, action, result);
				}
				resolve(result);
				break;
			}
			case 'dismissUpdateNotification': {
				const { updateCheckState = {} } = await browser.storage.local.get('updateCheckState');
				delete updateCheckState.pendingUpdateNotification;
				await browser.storage.local.set({ updateCheckState });
				resolve();
				break;
			}
			case 'update_adareqlim': {
				RequestQueue.loadRequestThreshold().then(resolve);
				break;
			}
		}
	});
});

async function getTabs(request) {
	let items = [
		{
			id: 'inbox_sg',
			url: `https://www.steamgifts.com/messages`,
		},
		{
			id: 'inbox_st',
			url: `https://www.steamtrades.com/messages`,
		},
		{
			id: 'wishlist',
			url: `https://www.steamgifts.com/giveaways/search?type=wishlist`,
		},
		{
			id: 'won',
			url: `https://www.steamgifts.com/giveaways/won`,
		},
	];
	let any = false;
	for (let i = 0, n = items.length; i < n; i++) {
		let item = items[i];
		if (!request[item.id]) {
			continue;
		}
		const tab = openTabs.find((tab) => tab.url.startsWith(item.url));
		if (tab && tab.id) {
			await updateTab(tab.id, { active: true });
			if (request.refresh) {
				browser.tabs.reload(tab.id);
			}
		} else if (request.any) {
			any = true;
		} else {
			openTab(item.url);
		}
	}
	if (any) {
		const tab = openTabs.find((tab) => tab.url.startsWith('https://www.steamgifts.com'));
		if (tab && tab.id) {
			await updateTab(tab.id, { active: true });
		}
	}
}

async function openTab(url) {
	const options = { url };
	const tab = (await browser.tabs.query({ active: true }))[0];
	if (tab) {
		options.index = tab.index + 1;
		if (
			(await browser.permissions.contains({ permissions: ['cookies'] })) &&
			'cookieStoreId' in tab
		) {
			options.cookieStoreId = tab.cookieStoreId;
		}
	}
	return browser.tabs.create(options);
}

function queryTabs(query) {
	return browser.tabs.query(query);
}

function updateTab(id, parameters) {
	return browser.tabs.update(id, parameters);
}

async function activateTab(host) {
	const tab = openTabs.find((tab) => tab.url.startsWith(host));
	if (tab && tab.id) {
		await updateTab(tab.id, { active: true });
	}
}
