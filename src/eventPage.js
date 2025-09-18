import JSZip from 'jszip';
import { RequestQueue } from './class/Queue';

const locks = {};
const SESSION_FLAG_KEY = 'activatedFirstSteamTab';

const StorageManager = (() => {
	const STORAGE_KEY = 'persistedState';
	const SAVE_DELAY = 2000;
	const BACKUP_INTERVAL_MIN = 5;
	let saveTimeout = null;
	let _lastPersistedIncremental = {};

	self.cache = {
		requestLog: [],
		settings: {},
		lastRequests: {},
		tdsData: [],
		openTabs: [],
	};

	async function saveNow() {
		try {
			const toPersist = {};
			const keysToCheck = ['tdsData', 'openTabs'];

			for (const key of keysToCheck) {
				const current = self.cache[key];
				const last = _lastPersistedIncremental[key];

				if (current === last) continue;

				if (Array.isArray(current) && Array.isArray(last)) {
					if (current.length === last.length) {
						let same = true;
						for (let i = 0; i < current.length; i++) {
							if (current[i] !== last[i]) { same = false; break; }
						}
						if (same) continue;
					}
				} else if (current && last && typeof current === 'object' && typeof last === 'object') {

					const currKeys = Object.keys(current);
					const lastKeys = Object.keys(last);
					if (currKeys.length === lastKeys.length) {
						let same = true;
						for (const k of currKeys) {
							if (current[k] !== last[k]) { same = false; break; }
						}
						if (same) continue;
					}
				} else {

				}

				if (JSON.stringify(current) !== JSON.stringify(last)) {
					toPersist[key] = current;
				}
			}

			if (Object.keys(toPersist).length === 0) return;

			const merged = { ..._lastPersistedIncremental, ...toPersist };
			await chrome.storage.local.set({ [STORAGE_KEY]: merged });
			_lastPersistedIncremental = merged;
		} catch (err) {
			console.error('[StorageManager] Incremental save failed', err);
		}
	}

	function scheduleSave() {
		if (saveTimeout) return;
		saveTimeout = setTimeout(async () => {
			saveTimeout = null;
			try { await saveNow(); } catch (e) { console.error('[StorageManager] saveNow failed', e); }
		}, SAVE_DELAY);
	}

	const _updateLocks = {};

	async function update(key, updater) {
		if (!_updateLocks[key]) _updateLocks[key] = Promise.resolve();

		_updateLocks[key] = _updateLocks[key].then(async () => {
			try {
				const current = self.cache[key];
				const newValue = await updater(current);
				self.cache[key] = newValue;
				if (['tdsData', 'openTabs'].includes(key)) scheduleSave();
			} catch (e) {
				console.error(`[StorageManager] update failed for ${key}`, e);
				throw e;
			}
		}).catch((e) => console.error(`[StorageManager] update failed for ${key}`, e));

		return _updateLocks[key];
	}

	async function updateBatch(updates) {
		const keys = Object.keys(updates).filter(k => ['tdsData', 'openTabs', 'lastRequests'].includes(k));
		if (keys.length === 0) return;

		const promises = keys.map(key => {
			if (!_updateLocks[key]) _updateLocks[key] = Promise.resolve();
			_updateLocks[key] = _updateLocks[key].then(async () => {
				try {
					const current = self.cache[key];
					const newValue = await updates[key](current);
					self.cache[key] = newValue;
				} catch (e) {
					console.error(`[StorageManager] updateBatch failed for ${key}`, e);
					throw e;
				}
			}).catch(e => console.error(`[StorageManager] updateBatch failed for ${key}`, e));
			return _updateLocks[key];
		});

		await Promise.all(promises);

		if (keys.some(k => ['tdsData', 'openTabs'].includes(k))) scheduleSave();
	}

	async function set(key, value) {
		const oldValue = self.cache[key];
		if (oldValue === value) return;

		let hasChanged = true;
		if (typeof value === 'object' && value !== null && typeof oldValue === 'object' && oldValue !== null) {
			try {
				hasChanged = JSON.stringify(oldValue) !== JSON.stringify(value);
			} catch {
				hasChanged = true;
			}
		}

		if (!hasChanged) return;

		self.cache[key] = value;
		if (['tdsData', 'openTabs'].includes(key)) scheduleSave();
	}

	async function load() {
		const result = await chrome.storage.local.get(['settings', STORAGE_KEY, 'requestLog']);

		self.cache.settings = result.settings ? JSON.parse(result.settings) : {};
		if (result[STORAGE_KEY]) Object.assign(self.cache, result[STORAGE_KEY]);

		if (result.requestLog) {
			try { self.cache.requestLog = JSON.parse(result.requestLog); }
			catch (e) { console.warn('[StorageManager] Failed to parse requestLog', e); self.cache.requestLog = []; }
		}

		if (chrome.alarms) {
			try {
				await chrome.alarms.clear("flushStorage");
				chrome.alarms.create("flushStorage", { periodInMinutes: BACKUP_INTERVAL_MIN });
			} catch (e) { console.warn('[StorageManager] Failed creating flushStorage alarm', e); }

			chrome.alarms.onAlarm.addListener(async (alarm) => {
				if (alarm.name === "flushStorage") {
					if (saveTimeout) {
						clearTimeout(saveTimeout);
						saveTimeout = null;
					}
					await saveNow();
				}
			});
		}
	}

	function get(key) { return self.cache[key]; }

	chrome.storage.onChanged.addListener((changes, area) => {
		if (area !== "local") return;
		for (const [key, { newValue }] of Object.entries(changes)) {
			if (key === 'settings') {
				try { self.cache.settings = JSON.parse(newValue || "{}"); } catch { self.cache.settings = {}; }
				syncSteamTabs(self.cache.settings).catch(() => { });
				scheduleUpdateChecks();
			}
			if (key === STORAGE_KEY && newValue) Object.assign(self.cache, newValue);
			if (key === 'requestLog') {
				try { self.cache.requestLog = JSON.parse(newValue || "[]"); } catch { self.cache.requestLog = []; }
			}
		}
	});

	const lastRequestsLocks = {};

	async function getLastRequest(key) {
		const lastRequests = self.cache.lastRequests || {};
		return lastRequests[key] ?? 0;
	}

	async function setLastRequest(key, timestamp) {
		if (!lastRequestsLocks[key]) lastRequestsLocks[key] = Promise.resolve();

		lastRequestsLocks[key] = lastRequestsLocks[key].then(async () => {
			self.cache.lastRequests[key] = timestamp;
		}).catch((e) => console.error(`[StorageManager] setLastRequest failed for ${key}`, e));

		return lastRequestsLocks[key];
	}

	return { load, saveNow, get, set, update, updateBatch, getLastRequest, setLastRequest };
})();

RequestQueue.getLastRequest = (key) => {
	const lastRequests = StorageManager.get('lastRequests') || {};
	return lastRequests[key] ?? 0;
};
RequestQueue.setLastRequest = async (key, lastRequest) => {
	await StorageManager.update('lastRequests', (lr) => ({ ...lr, [key]: lastRequest }));
};
RequestQueue.getRequestThresholds = async () => {
	const settings = StorageManager.get('settings') || {};
	if (settings['useCustomAdaReqLim_sg']) {
		const thresholds = {};
		for (const [key, minThreshold] of Object.entries(RequestQueue.queue?.sg?.minThresholds || {})) {
			thresholds[key] = parseFloat(settings[`customAdaReqLim_${key}`] ?? 0.0);
			if (thresholds[key] < minThreshold) thresholds[key] = minThreshold;
		}
		return thresholds;
	}
	return { ...(RequestQueue.queue?.sg?.minThresholds || {}) };
};
RequestQueue.getRequestLog = async () => {
	return self.cache.requestLog || [];
};


function isNewerVersion(a, b) {
	const pa = a.split('.').map(Number);
	const pb = b.split('.').map(Number);
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const na = pa[i] || 0;
		const nb = pb[i] || 0;
		if (na > nb) return true;
		if (na < nb) return false;
	}
	return false;
}

async function checkRemoteVersionSW({ ignoreLastNotified = false, manual = false } = {}) {
	try {
		const manifest = chrome.runtime.getManifest();
		const currentVersion = manifest.version;
		const refsResponse = await fetch(
			'https://api.github.com/repos/SquishedPotatoe/esgst/git/matching-refs/tags'
		);
		const refsJson = await refsResponse.json();
		const mv3Versions = refsJson
			.map(ref => {
				const match = ref.ref.match(/^refs\/tags\/Mv3-v(\d+\.\d+\.\d+)$/);
				return match ? match[1] : null;
			})
			.filter(Boolean);

		if (mv3Versions.length === 0) {
			return;
		}

		mv3Versions.sort((a, b) => {
			const aParts = a.split('.').map(Number);
			const bParts = b.split('.').map(Number);
			for (let i = 0; i < 3; i++) {
				if (aParts[i] !== bParts[i]) return bParts[i] - aParts[i];
			}
			return 0;
		});

		const latestVersion = mv3Versions[0];
		const stored = (await chrome.storage.local.get(['settings']))?.settings
			? JSON.parse((await chrome.storage.local.get(['settings'])).settings)
			: {};
		const lastNotified = stored.lastNotifiedVersion ?? null;
		const isNew = isNewerVersion(latestVersion, currentVersion);
		const shouldNotify = isNew && (ignoreLastNotified || latestVersion !== lastNotified);

		if (shouldNotify) {
			chrome.tabs.query({}, (tabs) => {
				for (const tab of tabs) {
					if (isSteamTab(tab.url)) {
						chrome.tabs.sendMessage(tab.id, {
							action: 'showUpdatePopup',
							latestVersion,
							currentVersion
						}, (response) => {
							if (chrome.runtime.lastError) {
							}
						});
					}
				}
			});

			if (!ignoreLastNotified) {
				const result = await chrome.storage.local.get(['settings']);
				const settings = result.settings ? JSON.parse(result.settings) : {};
				settings.lastNotifiedVersion = latestVersion;
				await chrome.storage.local.set({ settings: JSON.stringify(settings) });
			}

		} else if (manual) {
			chrome.tabs.query({}, (tabs) => {
				for (const tab of tabs) {
					if (isSteamTab(tab.url)) {
						chrome.tabs.sendMessage(tab.id, {
							action: 'showUpToDatePopup',
							latestVersion,
							currentVersion
						}, (response) => {
							if (chrome.runtime.lastError) {
							}
						});
					}
				}
			});
		}

	} catch (err) {
		console.warn('[SW] Update check failed', err);
	}
}

async function scheduleUpdateChecks() {
	const data = (await StorageManager.get(['notifyNewVersion', 'updateCheckInterval'])) || {};
	const enabled = data.notifyNewVersion ?? false;
	if (!enabled) {
		await chrome.alarms.clear('checkUpdates');
		return;
	}

	const intervalDays = data.updateCheckInterval ?? 7;
	await chrome.alarms.clear('checkUpdates');
	await chrome.alarms.create('checkUpdates', { periodInMinutes: intervalDays * 24 * 60 });
}

chrome.runtime.onStartup.addListener(scheduleUpdateChecks);
chrome.alarms.onAlarm.addListener((alarm) => {
	if (alarm.name !== 'checkUpdates') return;
	checkRemoteVersionSW().catch(err => console.warn('[SW] Alarm check failed', err));
});
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
	try {
		if (message.action === 'manualCheckVersion') {
			checkRemoteVersionSW({ ignoreLastNotified: true, manual: true }).catch(err =>
				console.warn('[SW] Manual check failed', err)
			);
			sendResponse({ success: true });
		}

		else if (message.action === 'dismissUpdateNotification') {
			try {
				const result = await chrome.storage.local.get(['settings']);
				const settings = result.settings ? JSON.parse(result.settings) : {};
				settings.lastNotifiedVersion = message.version;

				await chrome.storage.local.set({ settings: JSON.stringify(settings) });

				sendResponse({ success: true });
			} catch (err) {
				console.warn('[SW] Failed to dismiss update notification', err);
				sendResponse({ success: false, error: err.message });
			}
		}

		else if (message.action === 'fetchChangelog') {
			const { previousVersion, currentVersion } = message;

			try {
				const refsResponse = await fetch(
					'https://api.github.com/repos/SquishedPotatoe/esgst/git/matching-refs/tags'
				);
				const refsJson = await refsResponse.json();

				const mv3Versions = refsJson
					.map(ref => {
						const match = ref.ref.match(/^refs\/tags\/Mv3-v(\d+\.\d+\.\d+)$/);
						return match ? match[1] : null;
					})
					.filter(Boolean);

				mv3Versions.sort((a, b) => {
					const pa = a.split('.').map(Number);
					const pb = b.split('.').map(Number);
					for (let i = 0; i < 3; i++) {
						if (pa[i] !== pb[i]) return pa[i] - pb[i];
					}
					return 0;
				});

				const changelogVersions = mv3Versions.filter(v =>
					isNewerVersion(v, previousVersion) && !isNewerVersion(v, currentVersion)
				);

				let changelog = '';
				for (const v of changelogVersions) {
					const tag = `Mv3-v${v}`;
					const releaseResponse = await fetch(
						`https://api.github.com/repos/SquishedPotatoe/esgst/releases/tags/${tag}`
					);
					const releaseData = await releaseResponse.json();
					if (releaseData && releaseData.body) {
						changelog += `## ${v}\n\n${releaseData.body.replace(
							/#(\d+)/g,
							'[$1](https://github.com/SquishedPotatoe/esgst/issues/$1)'
						)}\n\n`;
					}
				}

				sendResponse({ success: true, changelog });
			} catch (err) {
				console.warn('[SW] Failed to fetch changelog', err);
				sendResponse({ success: false, error: err.message });
			}
		}

	} catch (err) {
		console.warn('[SW] onMessage error', err);
	}

	return true;
});


async function getZip(data, fileName) {
	const zip = new JSZip();
	zip.file(fileName, data);
	return await zip.generateAsync({ compression: 'DEFLATE', compressionOptions: { level: 9 }, type: 'blob' });
}
async function readZip(data) {
	const zip = await JSZip.loadAsync(data);
	const output = [];
	for (const key of Object.keys(zip.files)) {
		output.push({ name: key, value: await zip.file(key).async('text') });
	}
	return output;
}

async function doFetch(parameters, request, sender, callbackOrPort) {
	const steamUrl = "https://store.steampowered.com/";
	let canManipulateCookies = request.manipulateCookies;
	if (canManipulateCookies) {
		try {
			const hasPermission = await chrome.permissions.contains({ permissions: ['cookies'] });
			if (!hasPermission) {
				canManipulateCookies = false;
				request.manipulateCookies = false;
			}
		} catch (e) {
			console.warn('[SW] permissions.contains failed', e);
			canManipulateCookies = false;
			request.manipulateCookies = false;
		}
	}

	let originalBirthtime = null, originalMature = null;
	if (canManipulateCookies) {
		try {
			originalBirthtime = await chrome.cookies.get({ url: steamUrl, name: "birthtime" });
			originalMature = await chrome.cookies.get({ url: steamUrl, name: "mature_content" });
			await chrome.cookies.set({ url: steamUrl, name: "birthtime", value: "0", secure: true, path: "/", sameSite: "no_restriction" });
			await chrome.cookies.set({ url: steamUrl, name: "mature_content", value: "1", secure: true, path: "/", sameSite: "no_restriction" });
		} catch (e) { console.warn('[SW] cookie manipulation failed', e); }
	}

	try {
		if (request.fileName) parameters.body = await getZip(parameters.body, request.fileName);
		const abortController = new AbortController();
		const timeoutId = setTimeout(() => abortController.abort(), request.timeout || 10000);
		parameters.signal = abortController.signal;
		const response = await fetch(request.url, parameters);
		clearTimeout(timeoutId);

		const contentLength = response.headers.get("content-length");
		const lengthBytes = contentLength ? parseInt(contentLength, 10) : 0;
		const USE_STREAMING_THRESHOLD = 1_000_000;
		const useStreaming = callbackOrPort?.postMessage && lengthBytes >= USE_STREAMING_THRESHOLD;

		let responseText = "";
		if (request.blob) {
			const zipData = await response.blob();
			const zip = await JSZip.loadAsync(zipData);
			const firstFile = Object.keys(zip.files)[0];
			responseText = firstFile ? await zip.file(firstFile).async("text") : "";
		} else if (useStreaming && response.body?.getReader) {
			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let received = 0;
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				received += value.length;
				responseText += decoder.decode(value, { stream: true });
				callbackOrPort.postMessage({ event: "progress", received });
			}
		} else {
			responseText = await response.text();
		}

		if (!response.ok) throw new Error(responseText);
		const result = { success: true, status: response.status, url: response.url, redirected: response.redirected, text: responseText };

		if (useStreaming) {
			callbackOrPort.postMessage({ event: "done", result });
			try { callbackOrPort.disconnect(); } catch { }
		} else {
			try { callbackOrPort(result); } catch { }
		}
	} catch (err) {
		const errorMsg = err?.message || String(err);
		const errorResult = { success: false, error: errorMsg };
		if (callbackOrPort?.postMessage) {
			try { callbackOrPort.postMessage({ event: "error", error: errorResult.error }); } catch { }
			try { callbackOrPort.disconnect(); } catch { }
		} else {
			try { callbackOrPort(errorResult); } catch { }
		}
	} finally {
		if (canManipulateCookies) {
			try {
				if (originalBirthtime) await chrome.cookies.set({ ...originalBirthtime });
				else await chrome.cookies.remove({ url: steamUrl, name: "birthtime" });
				if (originalMature) await chrome.cookies.set({ ...originalMature });
				else await chrome.cookies.remove({ url: steamUrl, name: "mature_content" });
			} catch (e) { console.warn('[SW] Failed to restore cookies', e); }
		}
	}
}

function do_lock(lock) { return new Promise((resolve) => _do_lock(lock, resolve)); }
function _do_lock(lock, resolve) {
	const now = Date.now();
	let locked = locks[lock.key];
	if (!locked || !locked.uuid || locked.timestamp < now - (lock.threshold + lock.timeout)) {
		locks[lock.key] = { timestamp: now, uuid: lock.uuid };
		setTimeout(() => {
			locked = locks[lock.key];
			if (!locked || locked.uuid !== lock.uuid) {
				if (!lock.tryOnce) setTimeout(() => _do_lock(lock, resolve), 0);
				else resolve(false);
			} else resolve(true);
		}, lock.threshold / 2);
	} else if (!lock.tryOnce) setTimeout(() => _do_lock(lock, resolve), lock.threshold / 3);
	else resolve(false);
}
function update_lock(lock) { if (locks[lock.key] && locks[lock.key].uuid === lock.uuid) locks[lock.key].timestamp = Date.now(); }
function do_unlock(lock) { if (locks[lock.key] && locks[lock.key].uuid === lock.uuid) delete locks[lock.key]; }

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	const safeParse = (str, fallback = {}) => { try { return JSON.parse(str); } catch { return fallback; } };
	(async () => {
		try {
			switch (request.action) {
				case 'get-tds': {
					let tdsData = StorageManager.get("tdsData");
					if (!Array.isArray(tdsData) || !tdsData.length) {
						try {
							const stored = await chrome.storage.local.get("persistedState");
							if (stored.tdsData && Array.isArray(stored.tdsData)) {
								tdsData = stored.tdsData;
								StorageManager.set("tdsData", tdsData);
							}
						} catch (e) {
							console.warn("[SW] Failed to rehydrate tdsData", e);
						}
					}

					sendResponse({ success: true, values: tdsData });
					break;
				}

				case 'notify-tds': {
					const payload = request.values || {};
					let subscribedItems = Array.isArray(payload.subscribedItems) ? payload.subscribedItems : [];
					const itemsForSW = Array.isArray(payload.itemsForSW) ? payload.itemsForSW : [];

					subscribedItems = subscribedItems.map(item => ({
						...item,
						type: item.type || 'discussions'
					}));

					const seen = new Set();
					subscribedItems = subscribedItems.filter(item => {
						const key = `${item.code}_${item.type}`;
						if (seen.has(key)) return false;
						seen.add(key);
						return true;
					});

					try {
						await StorageManager.set("tdsData", subscribedItems);
					} catch (e) {
						console.warn("[SW] Failed saving tdsData", e);
					}

					if (itemsForSW.length) showTdsNotification(itemsForSW);

					try {
						const tabs = await chrome.tabs.query({});
						for (const tab of tabs) {
							if (!tab.id || !isSteamTab(tab.url)) continue;
							chrome.tabs.sendMessage(tab.id, {
								action: 'update-tds',
								values: subscribedItems,
							}).catch(() => {
							});
						}
					} catch (e) {
						console.warn("[SW] Failed broadcasting update-tds", e);
					}

					sendResponse({ success: true });
					break;
				}
				case 'flush': await StorageManager.saveNow(); sendResponse({ success: true }); break;
				case 'permissions_contains': {
					const permObj = safeParse(request.permissions, null);
					if (!permObj) { sendResponse({ success: false, error: 'Invalid permissions object' }); break; }
					sendResponse({ success: true, result: await chrome.permissions.contains(permObj) }); break;
				}
				case 'permissions_request': sendResponse({ success: true, result: await chrome.permissions.request(safeParse(request.permissions, null)) }); break;
				case 'permissions_remove': sendResponse({ success: true, result: await chrome.permissions.remove(safeParse(request.permissions, null)) }); break;
				case 'queue_request': sendResponse({ success: true, result: await RequestQueue.enqueue(request.key) }); break;
				case 'get_request_log': sendResponse({ success: true, log: await RequestQueue.getRequestLog() }); break;
				case 'do_lock': sendResponse({ success: true, locked: await do_lock(request.lock) }); break;
				case 'update_lock': update_lock(request.lock); sendResponse({ success: true }); break;
				case 'do_unlock': do_unlock(request.lock); sendResponse({ success: true }); break;
				case "fetch": {
					const params = safeParse(request.parameters, {}); params.headers = new Headers(params.headers || {});
					doFetch(params, request, sender, sendResponse); return;
				}
				case 'reload': chrome.runtime.reload(); sendResponse({ success: true }); break;
				case 'tabs': {
					let openTabs = StorageManager.get("openTabs");
					if (!Array.isArray(openTabs) || !openTabs.length) {
						try {
							const stored = await chrome.storage.local.get("openTabs");
							if (stored.openTabs && Array.isArray(stored.openTabs)) {
								openTabs = stored.openTabs;
							}
						} catch (e) {
							console.warn("[SW] Failed to rehydrate openTabs", e);
						}
					}

					await syncSteamTabs(request, openTabs);
					sendResponse({ success: true });
					break;
				}

				case 'open_tab': await openTab(request.url); sendResponse({ success: true }); break;
				case 'update_adareqlim': if (typeof RequestQueue.loadRequestThreshold === 'function') await RequestQueue.loadRequestThreshold(); sendResponse({ success: true }); break;
				default: sendResponse({ success: false, error: 'Unknown action' });
			}
		} catch (err) { console.error('SW error', err); sendResponse({ success: false, error: String(err) }); }
	})();
	return true;
});

async function showTdsNotification(subscribedItems) {
	const updatedItems = subscribedItems.filter(item => item.diff > 0);
	if (!updatedItems.length) return;

	const newest = updatedItems[updatedItems.length - 1];
	const body = `${newest.name}: ${newest.diff} new ${newest.type === 'forum' ? 'threads' : 'comments'}`;
	const permission = await Notification.permission;
	if (permission === 'granted') {
		chrome.notifications.create('TDS', {
			type: 'basic',
			iconUrl: chrome.runtime.getURL("icon.png"),
			title: 'ESGST Notification',
			message: body,
		});
	}
}

async function openTab(url) {
	const options = { url };
	try {
		const activeTabs = await chrome.tabs.query({ active: true });
		const tab = activeTabs && activeTabs[0];
		if (tab) {
			options.index = tab.index + 1;
			try { if (await chrome.permissions.contains({ permissions: ['cookies'] }) && tab.cookieStoreId) options.cookieStoreId = tab.cookieStoreId; } catch { }
		}
		return chrome.tabs.create(options);
	} catch (e) { console.error('[SW] openTab failed', e); }
}

function isSteamTab(url) {
	return url.startsWith('https://www.steamgifts.com') || url.startsWith('https://www.steamtrades.com');
}

async function trackTab(tab) {
	if (!tab.id || !isSteamTab(tab.url)) return;

	const openTabs = StorageManager.get("openTabs") || [];
	const newEntry = { id: tab.id, url: tab.url };

	const idx = openTabs.findIndex((t) => t.id === tab.id);
	if (idx !== -1) openTabs[idx] = newEntry;
	else openTabs.push(newEntry);

	await StorageManager.set("openTabs", openTabs);
}

chrome.tabs.onCreated.addListener(async (tab) => {
	await trackTab(tab);
});
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
	if (changeInfo.status === "complete") await trackTab(tab);
});
chrome.tabs.onRemoved.addListener(async (tabId) => {
	let openTabs = StorageManager.get("openTabs") || [];
	const existed = openTabs.some((t) => t.id === tabId);
	if (!existed) return;

	openTabs = openTabs.filter((t) => t.id !== tabId);
	await StorageManager.set("openTabs", openTabs);
});

async function syncSteamTabs(request = {}) {
	let openTabs = StorageManager.get("openTabs");
	if (!Array.isArray(openTabs)) openTabs = [];
	openTabs = openTabs.slice();

	try {
		const settings = self.cache.settings || {};
		const activateTab_sg = request.activateTab_sg ?? settings.activateTab_sg;
		const activateTab_st = request.activateTab_st ?? settings.activateTab_st;
		const refresh = request.refresh ?? settings.refresh;
		const any = request.any ?? settings.any;
		const items = [
			{ id: 'inbox_sg', url: 'https://www.steamgifts.com/messages' },
			{ id: 'inbox_st', url: 'https://www.steamtrades.com/messages' },
			{ id: 'wishlist', url: 'https://www.steamgifts.com/giveaways/search?type=wishlist' },
			{ id: 'won', url: 'https://www.steamgifts.com/giveaways/won' },
		];

		for (const item of items) {
			if (!request[item.id]) continue;

			const tracked = openTabs.find(t => t.url.startsWith(item.url));
			if (tracked?.id) {
				if (refresh) {
					try { await chrome.tabs.reload(tracked.id); } catch { }
				}
				try { await chrome.tabs.update(tracked.id, { active: true }); } catch { }
			} else if (!any) {
				try {
					const created = await chrome.tabs.create({ url: item.url });
					openTabs.push({ id: created.id, url: item.url });
				} catch (e) {
					console.warn('[SW] Failed to create tab for', item.url, e);
				}
			}
		}

		const sessionFlag = await chrome.storage.session.get(SESSION_FLAG_KEY);
		if (!sessionFlag[SESSION_FLAG_KEY] && (activateTab_sg || activateTab_st)) {
			try {
				const currentTab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
				const tabs = await chrome.tabs.query({});
				const sgTabs = activateTab_sg ? tabs.filter(t => t.url.startsWith('https://www.steamgifts.com')) : [];
				const stTabs = activateTab_st ? tabs.filter(t => t.url.startsWith('https://www.steamtrades.com')) : [];
				const targets = [...sgTabs, ...stTabs];

				for (const targetTab of targets) {
					try { await chrome.tabs.reload(targetTab.id); } catch (e) { console.warn('[SW] Failed to reload tab', targetTab.id, e); }
					try { await chrome.tabs.update(targetTab.id, { active: true }); } catch (e) { console.warn('[SW] Failed to activate tab', targetTab.id, e); }
				}

				const shouldRestore = currentTab?.url && isSteamTab(currentTab.url);
				if (shouldRestore) {
					try { await chrome.tabs.update(currentTab.id, { active: true }); }
					catch (e) { console.warn('[SW] Failed to restore previous SG/ST tab', currentTab.id, e); }
				}

				await chrome.storage.session.set({ [SESSION_FLAG_KEY]: true });
			} catch (e) {
				console.warn('[SW] Failed during one-time SG/ST activation', e);
			}
		}

	} catch (e) {
		console.error('[SW] syncSteamTabs error', e);
	}
}

async function bootstrap() {
	if (self._bootstrapped) return;
	self._bootstrapped = true;

	self.SW_VERSION = '3.0.0';

	const originalLog = console.log;
	const originalWarn = console.warn;
	const originalError = console.error;

	function getFormattedTime() {
		const now = new Date();
		const pad = (n, z = 2) => n.toString().padStart(z, '0');
		const year = now.getFullYear();
		const month = pad(now.getMonth() + 1);
		const day = pad(now.getDate());
		const hours = pad(now.getHours());
		const minutes = pad(now.getMinutes());
		const seconds = pad(now.getSeconds());
		const ms = pad(now.getMilliseconds(), 3);
		return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
	}

	console.log = (...args) => originalLog(`[SW ${self.SW_VERSION}] [${getFormattedTime()}]`, ...args);
	console.warn = (...args) => originalWarn(`[SW ${self.SW_VERSION}] [${getFormattedTime()}]`, ...args);
	console.error = (...args) => originalError(`[SW ${self.SW_VERSION}] [${getFormattedTime()}]`, ...args);

	const debugLog = (...args) => console.log(...args);

	debugLog('Bootstrap starting');

	try {
		await StorageManager.load();
		debugLog('StorageManager loaded', self.cache);

		if (typeof RequestQueue.init === 'function') {
			RequestQueue.init();
			debugLog('RequestQueue init() called');
		}

		try {
			const thresholds = await RequestQueue.getRequestThresholds();
			if (RequestQueue.queue?.sg) {
				RequestQueue.queue.sg.thresholds = thresholds;
				debugLog('RequestQueue thresholds set', thresholds);
			}
		} catch (e) {
			console.error('Failed setting RequestQueue thresholds', e);
		}

		try {
			const tabs = await chrome.tabs.query({});
			const openTabs = [];
			for (const tab of tabs) {
				if (tab.id && tab.url && isSteamTab(tab.url)) {
					openTabs.push({ id: tab.id, url: tab.url });
				}
			}
			await StorageManager.set("openTabs", openTabs);
			debugLog('Open tabs built in bootstrap', openTabs);

			await syncSteamTabs();
			debugLog('syncSteamTabs run on bootstrap');
		} catch (e) {
			console.error('Failed to build or sync openTabs on bootstrap', e);
		}
	} catch (err) {
		console.error('Bootstrap failed', err);
	}
}

chrome.runtime.onStartup.addListener(() => {
	bootstrap();
});
chrome.runtime.onInstalled.addListener(async (details) => {
	const currentVersion = chrome.runtime.getManifest().version;
	const lastVersion = await StorageManager.get('lastVersion');

	await StorageManager.set('lastVersion', currentVersion);

	if (details.reason === 'install') {
		await StorageManager.set('tdsData', []);
		await StorageManager.set('openTabs', []);
	} else if (details.reason === 'update' && lastVersion && lastVersion !== currentVersion) {
		chrome.tabs.query({}, (tabs) => {
			for (const tab of tabs) {
				if (isSteamTab(tab.url)) {
					chrome.tabs.sendMessage(tab.id, {
						action: 'showChangelog',
						previousVersion: lastVersion,
						currentVersion
					});
				}
			}
		});
	}
});

bootstrap();
