import { zip, unzipSync, strToU8, strFromU8 } from 'fflate';

const locks = {};
const SESSION_FLAG_KEY = 'activatedFirstSteamTab';
const SW_KEYS = [
	'customAdaReqLim_default', 'customAdaReqLim_minute50', 'customAdaReqLim_minute75',
	'customAdaReqLim_hourly75', 'customAdaReqLim_daily75', 'useCustomAdaReqLim_sg',
	'hr_a_sg', 'hr_a_st', 'activateTab_sg', 'activateTab_st', 'lastNotifiedVersion',
	'notifyNewVersion_sg', 'notifyNewVersion_st', 'updateCheckInterval',
];

async function ServiceWorkerSettings() {
	try {
		const result = await chrome.storage.local.get(['swSettings', 'settings']);
		if (result.swSettings) return;
		if (!result.settings) return;

		let parsed = {};
		try {
			parsed = JSON.parse(result.settings);
		} catch (err) { console.warn('Failed to parse full settings', err); return; }

		const Keys = [...SW_KEYS];

		const filtered = {};
		for (const key of Keys) {
			if (key in parsed) filtered[key] = parsed[key];
		}

		await chrome.storage.local.set({ swSettings: filtered });

		if (typeof StorageManager?.cache === 'object') {
			StorageManager.cache.settings = filtered;
		}

		if (RequestQueue?.queue) {
			for (const key in RequestQueue.queue) {
				if (typeof RequestQueue.loadThresholds === 'function') {
					await RequestQueue.loadThresholds(key);
				}
			}
		}
	} catch (err) { console.error('Failed to save service worker keys', err); }
}

const StorageManager = (() => {
	const PERSIST_STORAGE_KEY = 'persistedState';
	const PERSIST_KEYS = ['tdsData', 'openTabs', 'lastRequests'];
	const SW_SETTINGS_KEYS = SW_KEYS;
	const SAVE_DELAY = 2000;
	const BACKUP_INTERVAL_MIN = 5;
	let saveTimeout = null;
	let _lastPersistedIncremental = {};

	self.cache = {
		settings: {},
		lastRequests: {},
		tdsData: [],
		openTabs: [],
	};

	function _filterSettings(full) {
		const filtered = {};
		for (const key of SW_SETTINGS_KEYS) {
			if (key in full) filtered[key] = full[key];
		}
		return filtered;
	}

	async function saveNow() {
		try {
			const toPersist = {};

			for (const key of PERSIST_KEYS) {
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
				}

				if (JSON.stringify(current) !== JSON.stringify(last)) {
					toPersist[key] = current;
				}
			}

			if (Object.keys(toPersist).length === 0) return;

			const merged = { ..._lastPersistedIncremental, ...toPersist };
			await chrome.storage.local.set({ [PERSIST_STORAGE_KEY]: merged });
			_lastPersistedIncremental = merged;
		} catch (err) { console.error('[StorageManager] Incremental save failed', err); }
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
			const current = self.cache[key];
			const newValue = await updater(current);
			self.cache[key] = newValue;
			if (PERSIST_KEYS.includes(key)) scheduleSave();
		}).catch((e) => console.error(`[StorageManager] update failed for ${key}`, e));

		return _updateLocks[key];
	}

	async function updateBatch(updates) {
		const keys = Object.keys(updates).filter(k => PERSIST_KEYS.includes(k));
		if (keys.length === 0) return;

		const promises = keys.map(key => {
			if (!_updateLocks[key]) _updateLocks[key] = Promise.resolve();

			_updateLocks[key] = _updateLocks[key].then(async () => {
				const current = self.cache[key];
				const newValue = await updates[key](current);
				self.cache[key] = newValue;
			}).catch(e => console.error(`[StorageManager] updateBatch failed for ${key}`, e));

			return _updateLocks[key];
		});

		await Promise.all(promises);

		if (keys.length > 0) scheduleSave();
	}

	async function set(key, value) {
		const oldValue = self.cache[key];
		if (oldValue === value) return;

		let hasChanged = true;
		if (typeof value === 'object' && value !== null && typeof oldValue === 'object' && oldValue !== null) {
			try {
				hasChanged = JSON.stringify(oldValue) !== JSON.stringify(value);
			} catch { hasChanged = true; }
		}

		if (!hasChanged) return;

		self.cache[key] = value;
		if (PERSIST_KEYS.includes(key)) scheduleSave();
	}

	async function load() {
		const result = await chrome.storage.local.get([PERSIST_STORAGE_KEY, 'swSettings']);
		self.cache.settings = result.swSettings || {};

		if (result[PERSIST_STORAGE_KEY]) Object.assign(self.cache, result[PERSIST_STORAGE_KEY]);

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

	async function reloadSettings() {
		const result = await chrome.storage.local.get('swSettings');
		self.cache.settings = result.swSettings || {};
		return self.cache.settings;
	}

	function get(key) { return self.cache[key]; }

	chrome.storage.onChanged.addListener(async (changes, area) => {
		if (area !== "local") return;
		if (changes.swSettings) {
			const newSettings = changes.swSettings.newValue || {};
			const keysToMerge = Object.keys(newSettings).filter(k => k !== 'pendingUpdateNotification');
			for (const k of keysToMerge) self.cache.settings[k] = newSettings[k];

			if ('updateCheckInterval' in newSettings || 'notifyNewVersion_sg' in newSettings || 'notifyNewVersion_st' in newSettings) {
				await scheduleUpdateChecks();
			}
			return;
		}

		if (changes.settings) {
			try {
				const newSettings = JSON.parse(changes.settings.newValue || '{}');
				const filtered = _filterSettings(newSettings);
				Object.assign(self.cache.settings, filtered);
				await chrome.storage.local.set({ swSettings: self.cache.settings });
			} catch (err) { console.warn('[StorageManager] Failed parsing settings change', err); }
		}

		if (changes[PERSIST_STORAGE_KEY] && changes[PERSIST_STORAGE_KEY].newValue) {
			Object.assign(self.cache, changes[PERSIST_STORAGE_KEY].newValue);
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

	return { load, saveNow, get, set, update, updateBatch, getLastRequest, setLastRequest, reloadSettings };
})();

const RequestQueue = (() => {
	const MAX_QUEUE_LENGTH = 750;
	const _locks = {};

	const queue = {
		sg: {
			requests: [],
			threshold: 250,
			recent: { minute: [], hour: [], day: [] },
			limits: { minute: 120, hour: 2400, day: 14400 },
			thresholds: {},
			minThreshold: 100,
			maxThreshold: 4000,
			maxWindowSize: { minute: 200, hour: 5000, day: 20000 },
			maxBurst: 5
		}
	};

	const loadThresholds = async (key) => {
		const q = queue[key];
		const settings = StorageManager.get('settings') || {};
		const useCustom = settings[`useCustomAdaReqLim_${key}`]?.enabled;

		const defaultThresholds = {
			default: 0,
			minute50: 0.25,
			minute75: 0.5,
			hourly75: 1,
			daily75: 1.5
		};

		q.thresholds = useCustom
			? Object.fromEntries(
				Object.entries(defaultThresholds).map(([k, v]) => [
					k,
					parseFloat(settings[`customAdaReqLim_${k}`] ?? v)
				])
			)
			: defaultThresholds;

		const values = Object.values(q.thresholds).map(v => v * 1000);
		q.minThreshold = Math.min(...values, q.minThreshold);
		q.maxThreshold = Math.max(...values, q.maxThreshold);
		q.threshold = q.thresholds.default * 1000;
	};

	const enqueue = async (key) => {
		if (!queue[key]) {
			queue[key] = JSON.parse(JSON.stringify(queue.sg));
			queue[key].requests = [];
			await loadThresholds(key);
		}

		if (queue[key].requests.length >= MAX_QUEUE_LENGTH) {
			return Promise.reject(new Error('Request queue is full'));
		}

		queue[key].requests.push(() => { });
		return new Promise((resolve) => {
			queue[key].requests[queue[key].requests.length - 1] = resolve;
			processQueue(key);
		});
	};

	const pruneWindow = (window, cutoff, maxSize) => {
		while (window.length && window[0] <= cutoff) window.shift();
		if (window.length > maxSize) window.splice(0, window.length - maxSize);
	};

	const processQueue = async (key) => {
		const q = queue[key];
		if (!q || q.requests.length === 0) return;

		await (_locks[key] ?? Promise.resolve()).then(async () => {
			const now = Date.now();
			const last = await StorageManager.getLastRequest(key) || 0;

			const waitTime = Math.max(q.threshold - (now - last), 0);
			if (waitTime > 0) {
				setTimeout(() => processQueue(key), waitTime);
				return;
			}

			const burstCount = Math.max(1, Math.min(q.requests.length, q.maxBurst));
			const burstInterval = q.threshold / burstCount;

			const projectedCount = q.recent.minute.length + burstCount;
			let lookaheadThreshold = q.thresholds.default * 1000;

			if (projectedCount > q.limits.minute * 0.65) {
				lookaheadThreshold = q.thresholds.minute75 * 1000;
			} else if (projectedCount > q.limits.minute * 0.4) {
				lookaheadThreshold = q.thresholds.minute50 * 1000;
			}

			if (lookaheadThreshold !== q.threshold) {
				q.threshold = Math.min(q.maxThreshold, Math.max(q.minThreshold, lookaheadThreshold));
			}

			for (let i = 0; i < burstCount; i++) {
				const req = q.requests.shift();
				if (!req) continue;

				setTimeout(async () => {
					const ts = Date.now();
					await StorageManager.setLastRequest(key, ts);

					const { recent, maxWindowSize } = q;
					recent.minute.push(ts);
					recent.hour.push(ts);
					recent.day.push(ts);

					pruneWindow(recent.minute, ts - 60 * 1000, maxWindowSize.minute);
					pruneWindow(recent.hour, ts - 60 * 60 * 1000, maxWindowSize.hour);
					pruneWindow(recent.day, ts - 24 * 60 * 60 * 1000, maxWindowSize.day);

					const { minute, hour, day } = recent;
					let newThreshold = q.thresholds.default * 1000;

					if (day.length > q.limits.day * 0.75) {
						newThreshold = q.thresholds.daily75 * 1000;
					} else if (hour.length > q.limits.hour * 0.75) {
						newThreshold = q.thresholds.hourly75 * 1000;
					} else if (minute.length > q.limits.minute * 0.65) {
						newThreshold = q.thresholds.minute75 * 1000;
					} else if (minute.length > q.limits.minute * 0.40) {
						newThreshold = q.thresholds.minute50 * 1000;
					}

					if (newThreshold !== q.threshold) {
						q.threshold = Math.min(q.maxThreshold, Math.max(q.minThreshold, newThreshold));
					}

					req();
				}, i * burstInterval);
			}

			if (q.requests.length > 0) setTimeout(() => processQueue(key), q.threshold);
		}).catch(console.error);
	};

	StorageManager.getLastRequest = async (key) => {
		const lr = await StorageManager.get('lastRequests') || {};
		return lr[key] ?? 0;
	};

	StorageManager.setLastRequest = async (key, timestamp) => {
		await StorageManager.update('lastRequests', (lr = {}) => ({
			...lr,
			[key]: timestamp
		}));
	};

	const init = async () => {
		for (const key in queue) await loadThresholds(key);
	};

	return { queue, enqueue, init, loadThresholds };
})();

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

async function scheduleUpdateChecks() {
	const settings = StorageManager.get('settings') || {};
	const enabled = settings.notifyNewVersion_sg || settings.notifyNewVersion_st;

	if (!enabled) {
		await chrome.alarms.clear('checkUpdates');
		return;
	}

	const intervalDays = settings.updateCheckInterval ?? 7;
	const periodMinutes = intervalDays * 24 * 60;
	const alarms = await chrome.alarms.getAll();
	const existing = alarms.find(a => a.name === 'checkUpdates');

	if (existing) {
		if (existing.periodInMinutes !== periodMinutes) {
			await chrome.alarms.clear('checkUpdates');
			await chrome.alarms.create('checkUpdates', { periodInMinutes: periodMinutes });
		}
	} else {
		await chrome.alarms.create('checkUpdates', { periodInMinutes: periodMinutes });
	}
}

async function fetchMv3Versions() {
	const url = 'https://api.github.com/repos/SquishedPotatoe/esgst/git/matching-refs/tags';
	const res = await fetch(url);
	const data = await res.json();

	return data
		.map(ref => ref.ref.match(/^refs\/tags\/Mv3-v(\d+\.\d+\.\d+)$/)?.[1])
		.filter(Boolean)
		.sort((a, b) => {
			const pa = a.split('.').map(Number);
			const pb = b.split('.').map(Number);
			for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pb[i] - pa[i];
			return 0;
		});
}

async function checkRemoteVersionSW({ ignoreLastNotified = false } = {}) {
	try {
		const currentVersion = chrome.runtime.getManifest().version;
		const mv3Versions = await fetchMv3Versions();

		if (!mv3Versions.length) return { latestVersion: null, isNew: false };

		const latestVersion = mv3Versions[0];
		const settings = StorageManager.get('settings') || {};
		const lastNotified = settings.lastNotifiedVersion ?? null;
		const isNew = isNewerVersion(latestVersion, currentVersion);
		const shouldNotify = isNew && (ignoreLastNotified || latestVersion !== lastNotified);

		return { latestVersion, isNew: shouldNotify };
	} catch (err) {
		console.warn('[SW] Update check failed', err);
		return { latestVersion: null, isNew: false };
	}
}

chrome.alarms.onAlarm.addListener((alarm) => {
	if (alarm.name !== 'checkUpdates') return;

	(async () => {
		try {
			const currentVersion = chrome.runtime.getManifest().version;
			const { latestVersion, isNew } = await checkRemoteVersionSW();

			if (!latestVersion || !isNew) return;

			const { swSettings = {} } = await chrome.storage.local.get('swSettings');

			if (latestVersion === swSettings.lastNotifiedVersion) return;

			const openTabs = await getOpenTabs();

			if (openTabs.length) {
				for (const { id, url } of openTabs) {
					if (!id || !isSgStTab(url)) continue;
					chrome.tabs.sendMessage(id, {
						action: 'showUpdatePopup',
						currentVersion,
						latestVersion
					});
				}
				delete swSettings.pendingUpdateNotification;
			} else {
				swSettings.pendingUpdateNotification = latestVersion;
			}

			swSettings.lastNotifiedVersion = latestVersion;
			await chrome.storage.local.set({ swSettings });
		} catch (err) {
			console.warn('[SW] Alarm update check failed', err);
		}
	})();
});

async function getZip(data, fileName) {
	return new Promise((resolve) => {
		const fileMap = {};
		fileMap[fileName] = strToU8(data);
		zip(fileMap, { level: 9 }, (err, zippedData) => {
			if (err) throw err;
			resolve(new Blob([zippedData], { type: 'application/zip' }));
		});
	});
}

async function readZip(data) {
	let u8 = data instanceof Uint8Array
		? data
		: data instanceof ArrayBuffer
			? new Uint8Array(data)
			: data instanceof Blob
				? new Uint8Array(await data.arrayBuffer())
				: null;

	if (!u8) throw new Error("Unsupported data type for readZip in SW");

	const files = unzipSync(u8);
	return Object.keys(files).map(name => ({ name, value: strFromU8(files[name]) }));
}

async function doFetch(parameters, request, sender, callbackOrPort) {
	const steamUrl = "https://store.steampowered.com/";
	const requestUrl = new URL(request.url);
	const isSteamStore = requestUrl.hostname === "store.steampowered.com";

	if (request.manipulateCookies) {
		try {
			const hasPermission = await chrome.permissions.contains({ permissions: ['cookies'] });
			if (!hasPermission) request.manipulateCookies = false;
		} catch (e) {
			console.warn('[SW] permissions.contains failed', e);
			request.manipulateCookies = false;
		}
	}

	let originalBirthtime = null, originalMature = null;
	if (isSteamStore && request.manipulateCookies) {
		try {
			originalBirthtime = await chrome.cookies.get({ url: steamUrl, name: "birthtime" });
			originalMature = await chrome.cookies.get({ url: steamUrl, name: "mature_content" });
			await chrome.cookies.set({ url: steamUrl, name: "birthtime", value: "0", secure: true, path: "/", sameSite: "no_restriction" });
			await chrome.cookies.set({ url: steamUrl, name: "mature_content", value: "1", secure: true, path: "/", sameSite: "no_restriction" });
			parameters.credentials = 'include';
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
			const files = await readZip(zipData);
			responseText = files[0]?.value || "";
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
		if (isSteamStore && request.manipulateCookies) {
			try {
				if (originalBirthtime) await chrome.cookies.set({ ...originalBirthtime });
				else await chrome.cookies.remove({ url: steamUrl, name: "birthtime" });
				if (originalMature) await chrome.cookies.set({ ...originalMature });
				else await chrome.cookies.remove({ url: steamUrl, name: "mature_content" });
			} catch (e) { console.warn('[SW] Failed to restore cookies', e); }
		}
	}
}

function do_lock(lock) {
	return new Promise((resolve) => {
		const now = Date.now();
		let locked = locks[lock.key];
		if (!locked || !locked.uuid || locked.timestamp < now - (lock.threshold + lock.timeout)) {
			locks[lock.key] = { timestamp: now, uuid: lock.uuid };
			setTimeout(() => {
				locked = locks[lock.key];
				if (!locked || locked.uuid !== lock.uuid) {
					if (!lock.tryOnce) setTimeout(() => do_lock(lock).then(resolve), 0);
					else resolve(false);
				} else resolve(true);
			}, lock.threshold / 2);
		} else if (!lock.tryOnce) {
			setTimeout(() => do_lock(lock).then(resolve), lock.threshold / 3);
		} else resolve(false);
	});
}

function update_lock(lock) { if (locks[lock.key] && locks[lock.key].uuid === lock.uuid) locks[lock.key].timestamp = Date.now(); }

function do_unlock(lock) { if (locks[lock.key] && locks[lock.key].uuid === lock.uuid) delete locks[lock.key]; }

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
						} catch (e) { console.warn("[SW] Failed to rehydrate tdsData", e); }
					}
					sendResponse({ success: true, values: tdsData });
					break;
				}
				case 'notify-tds': {
					const payload = request.values || {};
					let subscribedItems = Array.isArray(payload.subscribedItems) ? payload.subscribedItems : [];
					const itemsForSW = Array.isArray(payload.itemsForSW) ? payload.itemsForSW : [];

					subscribedItems = subscribedItems.map(item => ({ ...item, type: item.type || 'discussions' }));

					const seen = new Set();
					subscribedItems = subscribedItems.filter(item => {
						const key = `${item.code}_${item.type}`;
						if (seen.has(key)) return false;
						seen.add(key);
						return true;
					});

					try {
						await StorageManager.set("tdsData", subscribedItems);
					} catch (e) { console.warn("[SW] Failed saving tdsData", e); }

					if (itemsForSW.length) showTdsNotification(itemsForSW);

					const openTabs = await getOpenTabs();
					for (const { id, url } of openTabs) {
						if (!id || !isSgStTab(url)) continue;
						chrome.tabs.sendMessage(id, { action: 'update-tds', values: subscribedItems }).catch(() => { });
					}
					sendResponse({ success: true });
					break;
				}
				case 'flush': await StorageManager.saveNow(); sendResponse({ success: true }); break;
				case 'permissions_contains': sendResponse({ success: true, result: await chrome.permissions.contains(request.permissions) }); break;
				case 'permissions_request': sendResponse({ success: true, result: await chrome.permissions.request(request.permissions) }); break;
				case 'permissions_remove': sendResponse({ success: true, result: await chrome.permissions.remove(request.permissions) }); break;
				case 'queue_request': sendResponse({ success: true, result: await RequestQueue.enqueue(request.key) }); break;
				case 'do_lock': sendResponse({ success: true, locked: await do_lock(request.lock) }); break;
				case 'update_lock': update_lock(request.lock); sendResponse({ success: true }); break;
				case 'do_unlock': do_unlock(request.lock); sendResponse({ success: true }); break;
				case "fetch": {
					const params = request.parameters;
					params.headers = new Headers(params.headers || {});
					doFetch(params, request, sender, sendResponse);
					return;
				}
				case 'reload': chrome.runtime.reload(); sendResponse({ success: true }); break;
				case 'tabs': await manageTabs(request); sendResponse({ success: true }); break;
				case 'open_tab': await openTab(request.url); sendResponse({ success: true }); break;
				case 'update_adareqlim': {
					await StorageManager.reloadSettings();
					for (const key of Object.keys(RequestQueue.queue)) {
						await RequestQueue.loadThresholds(key);
					}
					sendResponse({ success: true });
					break;
				}
				case 'pendingUpdateCheck': {
					const { swSettings } = await chrome.storage.local.get('swSettings');
					const latestVersion = swSettings?.pendingUpdateNotification;

					if (latestVersion && sender.tab?.id) {
						chrome.tabs.sendMessage(sender.tab.id, {
							action: 'showUpdatePopup',
							currentVersion: chrome.runtime.getManifest().version,
							latestVersion
						});
						delete swSettings.pendingUpdateNotification;
						await chrome.storage.local.set({ swSettings });
					}
					break;
				}
				case 'manualCheckVersion': {
					try {
						const { latestVersion, isNew } = await checkRemoteVersionSW({ ignoreLastNotified: true });

						if (latestVersion && isNew && sender.tab?.id) {
							const currentVersion = chrome.runtime.getManifest().version;

							chrome.tabs.sendMessage(sender.tab.id, {
								action: 'showUpdatePopup',
								currentVersion,
								latestVersion
							});
						}
						sendResponse({ success: true });
					} catch (err) {
						console.warn('[SW] Manual update check failed', err);
						sendResponse({ success: false, error: err.message });
					}
					break;
				}
				case 'dismissUpdateNotification': {
					const { swSettings = {} } = await chrome.storage.local.get('swSettings');
					swSettings.lastNotifiedVersion = request.version;
					await chrome.storage.local.set({ swSettings });
					sendResponse({ success: true });
					break;
				}
				case 'fetchChangelog': {
					const { previousVersion, currentVersion } = request;
					const mv3Versions = await fetchMv3Versions();
					const changelogVersions = mv3Versions.filter(
						v => isNewerVersion(v, previousVersion) && !isNewerVersion(v, currentVersion)
					);

					let changelog = '';
					for (const v of changelogVersions) {
						const tag = `Mv3-v${v}`;
						const releaseRes = await fetch(
							`https://api.github.com/repos/SquishedPotatoe/esgst/releases/tags/${tag}`
						);
						const release = await releaseRes.json();
						if (release?.body) {
							changelog += `## ${v}\n\n${release.body.replace(
								/#(\d+)/g,
								'[$1](https://github.com/SquishedPotatoe/esgst/issues/$1)'
							)}\n\n`;
						}
					}
					sendResponse({ success: true, changelog });
					break;
				}
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
	const permission = Notification.permission;
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

function isSgStTab(url) {
	return url.startsWith('https://www.steamgifts.com') || url.startsWith('https://www.steamtrades.com');
}

async function trackTab(tab) {
	if (!tab.id || !isSgStTab(tab.url)) return;

	const openTabs = await getOpenTabs();
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
	let openTabs = await getOpenTabs();
	const existed = openTabs.some((t) => t.id === tabId);
	if (!existed) return;

	openTabs = openTabs.filter((t) => t.id !== tabId);
	await StorageManager.set("openTabs", openTabs);
});

async function manageTabs(request = {}) {
	try {
		const settings = StorageManager.get('settings') || {};
		const hr_a_sg = !!settings.hr_a_sg?.enabled;
		const hr_a_st = !!settings.hr_a_st?.enabled;
		const activateTab_sg = request.activateTab_sg ?? !!settings.activateTab_sg?.enabled;
		const activateTab_st = request.activateTab_st ?? !!settings.activateTab_st?.enabled;
		const refresh = request.refresh;
		const any = request.any;
		const openTabs = await getOpenTabs();

		if (hr_a_sg || hr_a_st) {
			await notificationTabs(request, openTabs, { refresh, any });
		}

		if (activateTab_sg || activateTab_st) {
			await restoreTabs({ activateTab_sg, activateTab_st });
		}

	} catch (e) { console.error('[SW] manageTabs error', e); }
}

async function getOpenTabs() {
	let openTabs = StorageManager.get("openTabs");
	if (!Array.isArray(openTabs)) openTabs = [];
	return openTabs.slice();
}

async function notificationTabs(request, openTabs, { refresh, any }) {
	const tabItems = [
		{ id: 'inbox_sg', url: 'https://www.steamgifts.com/messages', host: 'steamgifts.com' },
		{ id: 'inbox_st', url: 'https://www.steamtrades.com/messages', host: 'steamtrades.com' },
		{ id: 'wishlist', url: 'https://www.steamgifts.com/giveaways/search?type=wishlist', host: 'steamgifts.com' },
		{ id: 'won', url: 'https://www.steamgifts.com/giveaways/won', host: 'steamgifts.com' },
	];

	const activeItems = tabItems.filter(item => request[item.id]);
	if (!activeItems.length) return;

	for (const { url, host } of activeItems) {
		const tracked = openTabs.find(t => t.url.startsWith(url));

		if (tracked?.id) {
			if (refresh) {
				try { await chrome.tabs.reload(tracked.id); } catch { }
			}
			try { await chrome.tabs.update(tracked.id, { active: true }); } catch { }
			continue;
		}

		if (any) {
			const candidate = openTabs.find(t => t.url.includes(host));
			if (candidate?.id) {
				try { await chrome.tabs.update(candidate.id, { active: true }); } catch { }
				continue;
			}
		}

		try { const created = await chrome.tabs.create({ url });} catch { }
	}
}

async function restoreTabs({ activateTab_sg, activateTab_st }) {
	const sessionFlag = await chrome.storage.session.get(SESSION_FLAG_KEY);
	if (sessionFlag[SESSION_FLAG_KEY]) return;

	try {
		const tabs = await chrome.tabs.query({});
		const currentTab = tabs.find(t => t.active && t.windowId === chrome.windows.WINDOW_ID_CURRENT);
		const sgTabs = activateTab_sg ? tabs.filter(t => t.url.startsWith('https://www.steamgifts.com')) : [];
		const stTabs = activateTab_st ? tabs.filter(t => t.url.startsWith('https://www.steamtrades.com')) : [];
		const targets = [...sgTabs, ...stTabs];

		for (const target of targets) {
			try { await chrome.tabs.reload(target.id); } catch { }
			try { await chrome.tabs.update(target.id, { active: true }); } catch { }
		}

		if (currentTab?.url && isSgStTab(currentTab.url)) {
			try { await chrome.tabs.update(currentTab.id, { active: true }); } catch { }
		}

		await chrome.storage.session.set({ [SESSION_FLAG_KEY]: true });
	} catch (e) { console.warn('[SW] Failed during one-time SG/ST activation', e); }
}

async function bootstrap() {
	if (self._bootstrapped) return;
	self._bootstrapped = true;

	self.SW_VERSION = '3.4.0';

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
		await ServiceWorkerSettings();
		debugLog('ServiceWorkerSettings initialized');
		await StorageManager.load().then(RequestQueue.init);
		debugLog('StorageManager loaded');
		debugLog('RequestQueue ready');

		try {
			const tabs = await chrome.tabs.query({});
			const openTabs = [];
			for (const tab of tabs) {
				if (tab.id && tab.url && isSgStTab(tab.url)) {
					openTabs.push({ id: tab.id, url: tab.url });
				}
			}
			await StorageManager.set("openTabs", openTabs);
			debugLog('Open tabs built in bootstrap');

			await manageTabs();
			debugLog('manageTabs run on bootstrap');
			await scheduleUpdateChecks();
		} catch (e) { console.error('Failed to build openTabs or manageTabs on bootstrap', e); }
	} catch (err) { console.error('Bootstrap failed', err); }
}

bootstrap();
