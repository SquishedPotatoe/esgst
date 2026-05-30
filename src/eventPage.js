import { getZip, readZip } from './lib/compression';

const locks = {};
const notificationMap = new Map();
let cachedPermissions = { permissions: new Set(), origins: new Set() };
const SW_KEYS = [
	'customAdaReqLim_default', 'customAdaReqLim_minute50', 'customAdaReqLim_minute75', 'customAdaReqLim_hourly75',
	'customAdaReqLim_daily75', 'useCustomAdaReqLim_sg', 'useCustomAdaReqLim_st', 'hr_a_sg', 'hr_a_st',
	'activateTab_sg', 'activateTab_st', 'lastNotifiedVersion', 'pendingUpdateNotification', 'tds_n_sg',
	'tds_n_st', 'notifyNewVersion_sg', 'notifyNewVersion_st', 'updateCheckInterval'
];
const SW_DEFAULTS = {
	customAdaReqLim_default: 0.25,
	customAdaReqLim_minute50: 0.5,
	customAdaReqLim_minute75: 1,
	customAdaReqLim_hourly75: 1.5,
	customAdaReqLim_daily75: 2,
	useCustomAdaReqLim_sg: false,
	useCustomAdaReqLim_st: false,
	hr_a_sg: false,
	hr_a_st: false,
	activateTab_sg: false,
	activateTab_st: false,
	tds_n_sg: false,
	tds_n_st: false,
	lastNotifiedVersion: null,
	pendingUpdateNotification: null,
	notifyNewVersion_sg: false,
	notifyNewVersion_st: false,
	updateCheckInterval: 7
};

function buildSwSettings(full) {
	const filtered = { ...SW_DEFAULTS };
	if (!full || typeof full !== 'object') return filtered;
	for (const key of SW_KEYS) {
		if (key in full) filtered[key] = full[key];
	}
	return filtered;
}

async function ServiceWorkerSettings() {
	try {
		const result = await chrome.storage.local.get(['swSettings', 'settings']);
		if (result.swSettings && Object.keys(result.swSettings).length > 0) return;

		let parsed = {};
		if (result.settings) {
			try {
				parsed = typeof result.settings === 'string' ? JSON.parse(result.settings) : result.settings;
			} catch (err) { console.warn('Failed to parse full settings', err); return; }
		}
		const filtered = buildSwSettings(parsed);

		await chrome.storage.local.set({ swSettings: filtered });

		if (typeof StorageManager?.cache === 'object') {
			StorageManager.cache.settings = filtered;
		}

		if (RequestQueue?.queues) {
			for (const key in RequestQueue.queues) {
				if (typeof RequestQueue.loadThresholds === 'function') {
					RequestQueue.loadThresholds(key);
				}
			}
		}
	} catch (err) { console.error('Failed to save service worker keys', err); }
}

const StorageManager = (() => {
	const PERSIST_STORAGE_KEY = 'persistedState';
	const PERSIST_KEYS = ['tdsData', 'openTabs', 'lastRequests'];
	const SW_SETTINGS_KEYS = SW_KEYS;
	const SAVE_DELAY_MIN = 0.15;
	const BACKUP_INTERVAL_MIN = 5;

	let _isDirty = false;
	let _dirtyKeys = new Set();
	let _lastPersistedIncremental = {};
	let _saveAlarmScheduled = false;

	const _updateLocks = {};

	self.cache = {
		settings: { ...SW_DEFAULTS },
		lastRequests: {},
		tdsData: [],
		openTabs: []
	};

	async function saveNow() {
		if (!_isDirty) return;

		try {
			const toPersist = {};
			const settingsDirty = _dirtyKeys.has('settings');

			for (const key of _dirtyKeys) {
				if (!PERSIST_KEYS.includes(key)) continue;

				toPersist[key] =
					key === 'lastRequests'
						? self.cache[key]
						: structuredClone(self.cache[key]);
			}

			if (!Object.keys(toPersist).length && !settingsDirty) {
				_isDirty = false;
				_dirtyKeys.clear();
				return;
			}

			const payload = {
				[PERSIST_STORAGE_KEY]: { ..._lastPersistedIncremental, ...toPersist },
				swSettings: structuredClone(self.cache.settings)
			};

			await chrome.storage.local.set(payload);

			_lastPersistedIncremental = payload[PERSIST_STORAGE_KEY];
			_isDirty = false;
			_dirtyKeys.clear();

			await chrome.alarms.clear("debounceSave");
			_saveAlarmScheduled = false;

		} catch (err) {
			console.error('[StorageManager] Save failed', err);
		}
	}

	function scheduleSave() {
		_isDirty = true;
		if (_saveAlarmScheduled) return;
		_saveAlarmScheduled = true;

		chrome.alarms.create("debounceSave", {
			delayInMinutes: SAVE_DELAY_MIN
		});
	}

	async function update(key, updater) {
		if (!_updateLocks[key]) _updateLocks[key] = Promise.resolve();

		_updateLocks[key] = _updateLocks[key].then(async () => {
			const currentClone = structuredClone(self.cache[key]);
			const result = await updater(currentClone);

			const isObjectFormat = result && typeof result === 'object' && 'value' in result && 'changed' in result;
			const newValue = isObjectFormat ? result.value : result;
			const didChange = isObjectFormat ? result.changed : true;

			if (didChange) {
				self.cache[key] = newValue;
				if (PERSIST_KEYS.includes(key) || key === 'settings') {
					_dirtyKeys.add(key);
					scheduleSave();
				}
			}
			return newValue;
		}).catch(e => console.error(`[StorageManager] update failed for ${key}`, e));

		return _updateLocks[key];
	}

	async function set(key, value) {
		if (JSON.stringify(self.cache[key]) === JSON.stringify(value)) return;

		self.cache[key] = value;
		if (PERSIST_KEYS.includes(key) || key === 'settings') {
			_dirtyKeys.add(key);
			scheduleSave();
		}
	}

	function get(key) {
		return self.cache[key];
	}

	async function getLastRequest(key) {
		return self.cache.lastRequests?.[key] ?? 0;
	}

	async function setLastRequest(key, ts) {
		self.cache.lastRequests[key] = ts;
		_dirtyKeys.add('lastRequests');
		scheduleSave();
	}

	async function load() {
		const result = await chrome.storage.local.get([PERSIST_STORAGE_KEY, 'swSettings']);
		self.cache.settings = buildSwSettings(result.swSettings);

		if (result[PERSIST_STORAGE_KEY]) {
			Object.assign(self.cache, result[PERSIST_STORAGE_KEY]);
			_lastPersistedIncremental = result[PERSIST_STORAGE_KEY];
		}

		chrome.alarms.create("flushStorage", { periodInMinutes: BACKUP_INTERVAL_MIN });
	}

	chrome.storage.onChanged.addListener(async (changes, area) => {
		if (area !== "local") return;
		if (changes.settings) {
			try {
				let full = changes.settings.newValue || {};
				if (typeof full === 'string') full = JSON.parse(full);

				const filtered = buildSwSettings(full);
				self.cache.settings = filtered;
				_dirtyKeys.add('settings');
				scheduleSave();

				if (typeof RequestQueue?.loadThresholds === 'function' && RequestQueue.queues) {
					for (const qKey of Object.keys(RequestQueue.queues)) {
						RequestQueue.loadThresholds(qKey);
					}
				}
			} catch (e) { console.warn('[StorageManager] Failed parsing settings change', e); }
		}

		if (changes.swSettings) {
			self.cache.settings = buildSwSettings(changes.swSettings.newValue || {});
		}

		if (changes[PERSIST_STORAGE_KEY]?.newValue) {
			const newData = changes[PERSIST_STORAGE_KEY].newValue;
			for (const key in newData) {
				if (key === 'lastRequests' && self.cache[key]) {
					Object.assign(self.cache[key], newData[key]);
				} else {
					self.cache[key] = newData[key];
				}
			}
			_lastPersistedIncremental = structuredClone(newData);
		}
	});

	chrome.alarms.onAlarm.addListener(async (alarm) => {
		if (alarm.name === "debounceSave" || alarm.name === "flushStorage") {
			await saveNow();
		}
	});

	chrome.runtime.onSuspend.addListener(() => {
		if (!_isDirty) return;
		try {
			const toPersist = {};
			for (const key of _dirtyKeys) {
				if (PERSIST_KEYS.includes(key)) toPersist[key] = self.cache[key];
			}
			chrome.storage.local.set({
				[PERSIST_STORAGE_KEY]: { ..._lastPersistedIncremental, ...toPersist },
				swSettings: self.cache.settings
			});
		} catch (e) { console.warn('[StorageManager] Suspend save failed', e); }
	});

	return { load, saveNow, get, set, update, getLastRequest, setLastRequest };
})();

const RequestQueue = (() => {
	const MAX_QUEUE_LENGTH = 750;
	const queues = {};
	const initPromises = new Map();

	const queueConfigs = {
		default: {
			limits: { minute: 60, hour: 2400, day: 14400 },
			minSpacing: 1.0,
			thresholds: { default: 1.0, minute50: 1.2, minute75: 1.5, hourly75: 2, daily75: 5 }
		},
		sg: {
			limits: { minute: 120, hour: 2400, day: 14400 },
			thresholds: { default: 0.25, minute50: 0.25, minute75: 0.5, hourly75: 1, daily75: 1.5 }
		},
		st: {
			limits: { minute: 60, hour: 2400, day: 14400 },
			minSpacing: 0.1,
			shortWindow: 17000,
			shortLimit: 10,
			shortBuffer: 500
		}
	};

	const template = {
		requests: [],
		highPrecision: [],
		pendingRecords: 0,
		buckets: {},
		cooldownUntil: 0,
		running: false,
		lastPersist: 0,
		limits: { minute: 120, hour: 2400, day: 14400 },
		thresholds: { default: 1.0, minute50: 1.2, minute75: 1.5, hourly75: 2, daily75: 5 },
		windows: { minute: 60000, hour: 3600000, day: 86400000 },
		counts: { minute: 0, hour: 0, day: 0 },
		Enabled: true
	};

	const now = () => Date.now();
	const getMinuteKey = (t) => Math.floor(t / 60000) * 60000;

	const loadThresholds = (key) => {
		const q = queues[key];
		if (!q) return;
		const settings = StorageManager.get('settings') || {};
		const useCustom = settings[`useCustomAdaReqLim_${key}`];
		q.Enabled = useCustom?.enabled || useCustom === true;

		if (!q.Enabled) return;

		for (const k in q.thresholds) {
			const val = settings[`customAdaReqLim_${k}`];
			if (val !== undefined && val !== "") {
				const parsed = parseFloat(val);
				if (!isNaN(parsed)) q.thresholds[k] = parsed;
			}
		}
	};

	const updateCounts = (q, t) => {
		const tenMinsAgo = t - 600000, hourAgo = t - 3600000, dayAgo = t - 86400000;
		q.highPrecision = q.highPrecision.filter(ts => ts > tenMinsAgo);
		q.counts.minute = q.highPrecision.filter(ts => ts > (t - 60000)).length;

		let hSum = 0, dSum = 0;
		for (const [mKeyStr, count] of Object.entries(q.buckets)) {
			const mKey = parseInt(mKeyStr);
			if (mKey < dayAgo) delete q.buckets[mKeyStr];
			else {
				dSum += count;
				if (mKey > hourAgo) hSum += count;
			}
		}
		q.counts.hour = hSum; q.counts.day = dSum;
	};

	const persist = async (key, q) => {
		await StorageManager.update('lastRequests', lr => {
			lr[key] = { highPrecision: q.highPrecision, buckets: q.buckets, cooldownUntil: q.cooldownUntil };
			return { value: lr, changed: true };
		});
	};

	const nextDelay = (q, key) => {
		const t = now();
		if (q.cooldownUntil > t) return q.cooldownUntil - t;
		if (q.Enabled === false) return 0;

		const cut = t - q.shortWindow - (key === 'st' ? (q.shortBuffer || 0) : 0);
		const activeWindow = q.highPrecision.filter(ts => ts > cut);
		const effectiveWindowLength = activeWindow.length + (key === 'st' ? (q.pendingRecords || 0) : 0);

		if (q.shortLimit && q.shortWindow && effectiveWindowLength >= q.shortLimit) {
			const wait = (activeWindow[0] + q.shortWindow + 1000) - t;
			return Math.max(wait, 1000);
		}

		if (key === 'st') return 0;

		updateCounts(q, t);
		let spacing = (q.minSpacing || 0) * 1000;
		const ratio = q.counts.minute / q.limits.minute;

		if (ratio > 0.75) spacing = Math.max(spacing, q.thresholds.minute75 * 1000);
		else if (ratio > 0.50) spacing = Math.max(spacing, q.thresholds.minute50 * 1000);
		else spacing = Math.max(spacing, q.thresholds.default * 1000);

		const last = q.highPrecision[q.highPrecision.length - 1];
		if (last) {
			const wait = spacing - (t - last);
			return wait > 0 ? wait : 0;
		}
		return 0;
	};

	const init = async (key) => {
		if (initPromises.has(key)) return initPromises.get(key);
		const task = (async () => {
			if (queues[key]) return;
			const q = structuredClone(template);
			const config = queueConfigs[key] || queueConfigs.default;

			q.thresholds = structuredClone(config.thresholds || queueConfigs.default.thresholds);
			q.minSpacing = config.minSpacing ?? (key === 'sg' ? 0 : 1.0);
			q.shortLimit = config.shortLimit ?? null;
			q.shortWindow = config.shortWindow ?? null;

			if (config.limits) q.limits = { ...q.limits, ...config.limits };
			Object.assign(q, { ...config, limits: q.limits, thresholds: q.thresholds });

			const data = StorageManager.get('lastRequests')?.[key];
			if (data) {
				q.highPrecision = data.highPrecision || [];
				q.buckets = data.buckets || {};
				q.cooldownUntil = data.cooldownUntil || 0;
			}
			queues[key] = q;
			loadThresholds(key);
			updateCounts(q, now());
		})();
		initPromises.set(key, task);
		return task;
	};

	const record = async (key) => {
		await init(key);
		const q = queues[key], t = now();
		if (key === 'st') {
		}
		if (key === 'st' && q.pendingRecords > 0) q.pendingRecords -= 1;
		q.highPrecision.push(t);
		q.buckets[getMinuteKey(t)] = (q.buckets[getMinuteKey(t)] || 0) + 1;
		updateCounts(q, t);
		await persist(key, q);
	};

	const injectCooldown = async (key, ms = 10000) => {
		await init(key);
		queues[key].cooldownUntil = now() + ms;
		await persist(key, queues[key]);
	};

	const enqueue = async (key) => {
		await init(key);
		const q = queues[key];
		if (q.requests.length >= MAX_QUEUE_LENGTH) throw new Error('Queue Full');
		return new Promise(resolve => {
			q.requests.push({ resolve });
			if (!q.running) processQueue(key);
		});
	};

	const processQueue = async (key) => {
		const q = queues[key];
		if (!q || q.running) return;
		q.running = true;

		while (q.requests.length > 0) {
			const delay = nextDelay(q, key);
			if (q.Enabled !== false && delay > 0) {
				q.running = false;
				setTimeout(() => processQueue(key), delay);
				return;
			}
			if (delay > 0) {
				q.running = false;
				setTimeout(() => processQueue(key), delay);
				return;
			}

			const req = q.requests.shift();
			const t = now();

			q.highPrecision.push(t);
			if (key === 'st') q.pendingRecords = (q.pendingRecords || 0) + 1;
			q.buckets[getMinuteKey(t)] = (q.buckets[getMinuteKey(t)] || 0) + 1;

			if (q.highPrecision.length % 20 === 0) await persist(key, q);
			req.resolve();

			if (q.minSpacing < 0.1 || q.thresholds.default < 0.1) {
				await new Promise(r => setTimeout(r, 0));
			}
		}
		q.running = false;
	};

	return { init, enqueue, record, injectCooldown, loadThresholds, queues };
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
	const existing = await chrome.alarms.get('checkUpdates');

	if (!existing || existing.periodInMinutes !== periodMinutes) {
		await chrome.alarms.clear('checkUpdates');
		await chrome.alarms.create('checkUpdates', {
			periodInMinutes: periodMinutes
		});
	}
}

async function fetchMv3Versions() {
	const url = 'https://api.github.com/repos/SquishedPotatoe/esgst/tags?per_page=100';
	const res = await fetch(url);

	if (!res.ok) throw new Error('Failed to fetch tags');

	const tags = await res.json();
	const versions = [];

	for (const tag of tags) {
		const match = tag.name.match(/^Mv3-v(\d+\.\d+\.\d+)$/);
		if (match) versions.push(match[1]);
	}
	return versions;
}

async function checkRemoteVersionSW() {
	try {
		const currentVersion = chrome.runtime.getManifest().version;
		const mv3Versions = await fetchMv3Versions();

		if (!mv3Versions.length) {
			return { latestVersion: null, isNewVersion: false };
		}

		const latestVersion = mv3Versions[0];
		const isNewVersion = isNewerVersion(latestVersion, currentVersion);

		return { latestVersion, isNewVersion };
	} catch (err) {
		console.warn('[SW] Update check failed', err);
		return { latestVersion: null, isNewVersion: false };
	}
}

chrome.alarms.onAlarm.addListener((alarm) => {
	if (alarm.name !== 'checkUpdates') return;

	(async () => {
		try {
			const currentVersion = chrome.runtime.getManifest().version;
			const { latestVersion, isNewVersion } = await checkRemoteVersionSW();

			if (!latestVersion || !isNewVersion) return;

			const { swSettings = {} } = await chrome.storage.local.get('swSettings');

			if (swSettings.lastNotifiedVersion === latestVersion) return;

			await chrome.storage.local.set({
				swSettings: {
					...swSettings,
					lastNotifiedVersion: latestVersion
				}
			});

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
				await chrome.storage.local.set({ swSettings });
			} else {
				swSettings.pendingUpdateNotification = latestVersion;
				await chrome.storage.local.set({
					swSettings
				});
			}
		} catch (err) {
			console.warn('[SW] Alarm update check failed', err);
		}
	})();
});

async function doFetch(parameters, request, sender, callbackOrPort) {
	const steamUrl = "https://store.steampowered.com/";
	const requestUrl = new URL(request.url);
	const isSteamStore = requestUrl.hostname === "store.steampowered.com";

	if (request.manipulateCookies) {
		try {
			const hasPermission = await runPermissionsAction('contains', { permissions: ['cookies'] });
			if (!hasPermission) {
				request.manipulateCookies = false;
				if (isSteamStore) {
					parameters.credentials = 'include';
				}
			}
		} catch (e) {
			console.warn('[SW] permissions.contains failed', e);
			request.manipulateCookies = false;
			if (isSteamStore) {
				parameters.credentials = 'include';
			}
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
		const start = Date.now();
		const attempt = () => {
			const now = Date.now();
			const locked = locks[lock.key];
			if (!locked || !locked.uuid || now - locked.timestamp > lock.threshold + lock.timeout) {
				locks[lock.key] = { timestamp: now, uuid: lock.uuid };
				setTimeout(() => {
					const current = locks[lock.key];
					if (!current || current.uuid !== lock.uuid) {
						if (!lock.tryOnce) setTimeout(attempt, 0);
						else resolve(false);
					} else resolve(true);
				}, lock.threshold / 2);
				return;
			}
			if (!lock.tryOnce && now - start < lock.timeout) {
				setTimeout(attempt, lock.threshold / 3);
			} else {
				resolve(false);
			}
		};
		attempt();
	});
}

function update_lock(lock) { if (locks[lock.key] && locks[lock.key].uuid === lock.uuid) locks[lock.key].timestamp = Date.now(); }

function do_unlock(lock) { if (locks[lock.key] && locks[lock.key].uuid === lock.uuid) delete locks[lock.key]; }

function getNotificationsApi() {
	return chrome.notifications;
}

function normalizePermissionList(values) {
	return Array.isArray(values) ? values.filter(Boolean) : [];
}

function setCachedPermissions({ permissions = [], origins = [] } = {}) {
	cachedPermissions = {
		permissions: new Set(normalizePermissionList(permissions)),
		origins: new Set(normalizePermissionList(origins)),
	};
}

async function refreshCachedPermissions() {
	const allPermissions = await chrome.permissions.getAll();
	setCachedPermissions(allPermissions);
	return allPermissions;
}

function hasCachedPermissions({ permissions = [], origins = [] } = {}) {
	for (const permission of normalizePermissionList(permissions)) {
		if (!cachedPermissions.permissions.has(permission)) {
			return false;
		}
	}

	for (const origin of normalizePermissionList(origins)) {
		if (!cachedPermissions.origins.has(origin)) {
			return false;
		}
	}

	return true;
}

async function runPermissionsAction(operation, permissions) {
	const permissionApi = chrome.permissions;
	if (!permissionApi?.[operation]) {
		throw new Error(`Unsupported permissions operation: ${operation}`);
	}

	if (operation === 'contains') {
		return hasCachedPermissions(permissions);
	}

	const result = await permissionApi[operation](permissions);
	await refreshCachedPermissions();
	return result;
}

function canUseNotifications() {
	return !!getNotificationsApi() && hasCachedPermissions({ permissions: ['notifications'] });
}

async function createExtensionNotification(id, options) {
	const notifications = getNotificationsApi();
	if (!notifications) return false;
	if (!canUseNotifications()) return false;

	await notifications.create(id, options);
	return true;
}

chrome.permissions.onAdded.addListener(async (permissions) => {
	setCachedPermissions({
		permissions: [...cachedPermissions.permissions, ...normalizePermissionList(permissions.permissions)],
		origins: [...cachedPermissions.origins, ...normalizePermissionList(permissions.origins)],
	});
});

chrome.permissions.onRemoved.addListener(async (permissions) => {
	for (const permission of normalizePermissionList(permissions.permissions)) {
		cachedPermissions.permissions.delete(permission);
	}
	for (const origin of normalizePermissionList(permissions.origins)) {
		cachedPermissions.origins.delete(origin);
	}
});

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
					const swSettings = StorageManager.get('settings') || {};
					const tdsNotifications = itemsForSW.some((item) =>
						item.type === 'trades'
							? !!swSettings.tds_n_st?.enabled
							: !!swSettings.tds_n_sg?.enabled
					);

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

					if (tdsNotifications && itemsForSW.length) await showTdsNotification(itemsForSW);

					const openTabs = await getOpenTabs();
					for (const { id, url } of openTabs) {
						if (!id || !isSgStTab(url)) continue;
						chrome.tabs.sendMessage(id, { action: 'update-tds', values: subscribedItems }).catch(() => { });
					}
					sendResponse({ success: true });
					break;
				}
				case 'flush': await StorageManager.saveNow(); sendResponse({ success: true }); break;
				case 'permissions':
					sendResponse({
						success: true,
						result: await runPermissionsAction(request.operation, request.permissions),
					});
					break;
				case 'record_request':
					RequestQueue.record(request.key);
					sendResponse({ success: true });
					break;
				case 'queue_request':
					RequestQueue.enqueue(request.key)
						.then(() => sendResponse({ success: true }))
						.catch(err => sendResponse({ success: false, error: err.message }));
					break;
				case 'rate_limit_hit': {
					const targetQueue = RequestQueue.queues[request.key];

					if (targetQueue) {
						if (request.key === 'st' && targetQueue.pendingRecords > 0) {
							targetQueue.pendingRecords -= 1;
						}
						const cooldownMs = request.cooldown || 65000;
						targetQueue.cooldownUntil = Date.now() + cooldownMs;

						StorageManager.set('lastRequests', {
							...StorageManager.get('lastRequests'),
							[request.key]: {
								highPrecision: targetQueue.highPrecision,
								buckets: targetQueue.buckets,
								cooldownUntil: targetQueue.cooldownUntil
							}
						});
					}
					sendResponse({ success: true });
					break;
				}
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
				case 'show_hr_notification': {
					const id = `hr_${Date.now()}_${Math.random().toString(36).slice(2)}`;
					const created = await createExtensionNotification(id, {
						type: 'basic',
						iconUrl: chrome.runtime.getURL('icon.png'),
						title: 'ESGST Notification',
						message: request.message,
						requireInteraction: !!request.requireInteraction,
					});

					if (!created) {
						sendResponse({ success: false, error: 'Missing notifications permission' });
						break;
					}

					notificationMap.set(id, {
						url: request.url,
						activateExisting: !!request.activateExisting,
						any: !!request.any,
						refresh: !!request.refresh,
					});

					sendResponse({ success: true, id });
					break;
				}
				case 'tabs': await manageTabs(request); sendResponse({ success: true }); break;
				case 'open_tab': await openTab(request.url); sendResponse({ success: true }); break;
				case 'pendingUpdateCheck': {
					const { swSettings = {} } = await chrome.storage.local.get('swSettings');
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
					sendResponse({ success: true });
					break;
				}
				case 'manualCheckVersion': {
					try {
						const { latestVersion, isNewVersion } = await checkRemoteVersionSW();

						if (latestVersion && isNewVersion && sender.tab?.id) {
							const currentVersion = chrome.runtime.getManifest().version;
							const { swSettings = {} } = await chrome.storage.local.get('swSettings');
							await chrome.storage.local.set({
								swSettings: {
									...swSettings,
									lastNotifiedVersion: latestVersion
								}
							});
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
					if (!request.version) {
						sendResponse({ success: false, error: 'Missing version' });
						break;
					}
					const { swSettings = {} } = await chrome.storage.local.get('swSettings');
					delete swSettings.pendingUpdateNotification;
					await chrome.storage.local.set({
						swSettings: {
							...swSettings,
							lastNotifiedVersion: request.version
						}
					});
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

	await createExtensionNotification('TDS', {
		type: 'basic',
		iconUrl: chrome.runtime.getURL("icon.png"),
		title: 'ESGST Notification',
		message: body,
	});
}

async function openTab(url) {
	const options = { url };
	try {
		const activeTabs = await chrome.tabs.query({ active: true });
		const tab = activeTabs && activeTabs[0];
		if (tab) {
			options.index = tab.index + 1;
			try { if (await runPermissionsAction('contains', { permissions: ['cookies'] }) && tab.cookieStoreId) options.cookieStoreId = tab.cookieStoreId; } catch { }
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
		const activateTab_sg = request.activateTab_sg;
		const activateTab_st = request.activateTab_st;
		const refresh = request.refresh;
		const any = request.any;
		const openTabs = await getOpenTabs();

		if (request.url && (hr_a_sg || hr_a_st)) {
			await notificationTabs(request.url, openTabs, { refresh, any });
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

async function notificationTabs(url, openTabs, { refresh, any }) {
	const host = new URL(url).host;
	const tracked = openTabs.find(t => t.url.startsWith(url));

	if (tracked?.id) {
		if (refresh) {
			try { await chrome.tabs.reload(tracked.id); } catch { }
		}
		try { await chrome.tabs.update(tracked.id, { active: true }); } catch { }
		return;
	}

	if (any) {
		const candidate = openTabs.find(t => t.url.includes(host));
		if (candidate?.id) {
			try { await chrome.tabs.update(candidate.id, { active: true }); } catch { }
			return;
		}
	}

	try { await chrome.tabs.create({ url }); } catch { }
}

const notifications = getNotificationsApi();

if (notifications?.onClicked) {
	notifications.onClicked.addListener(async (id) => {
		const payload = notificationMap.get(id);
		if (!payload) return;

		try {
			if (payload.activateExisting) {
				await manageTabs({
					url: payload.url,
					any: payload.any,
					refresh: payload.refresh,
				});
			} else if (payload.url) {
				await openTab(payload.url);
			}
		} finally {
			try { await notifications.clear(id); } catch { }
			notificationMap.delete(id);
		}
	});
}

if (notifications?.onClosed) {
	notifications.onClosed.addListener((id) => {
		notificationMap.delete(id);
	});
}

async function restoreTabs({ activateTab_sg, activateTab_st }) {
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
	} catch (e) { console.warn('[SW] Failed while activating SG/ST tab', e); }
}

async function bootstrap() {
	if (self._bootstrapped) return;
	self._bootstrapped = true;

	self.SW_VERSION = '4.0.3';

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
		await StorageManager.load();
		debugLog('StorageManager loaded');
		await refreshCachedPermissions();
		debugLog('Permissions cache loaded');

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
