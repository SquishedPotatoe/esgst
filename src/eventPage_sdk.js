import JSZip from '@progress/jszip-esm';
import { RequestQueue } from './class/Queue';

// Cu.import('resource://gre/modules/Console.jsm');
Cu.importGlobalProperties(['fetch', 'FileReader']);

const TYPE_SET = 0;
const TYPE_GET = 1;
const TYPE_DEL = 2;

const window = Services.appShell.hiddenDOMWindow;

// @ts-ignore
const file = FileUtils.getFile('ProfD', ['esgst.sqlite']);

const lastRequests = {};
const locks = {};
const workers = new Set();
const workerUrls = new Map();
let storage = {};
let tdsData = [];
let updateCheckTimer = null;
let cfChallengePromise = null;
let nextLoggedOutRequestId = 0;
const loggedOutRequests = new Map();
let hasAddedHttpObserver = false;

function isLoggedOutRequest(url) {
	if (!url) return false;
	const now = Date.now();
	for (const [id, req] of loggedOutRequests.entries()) {
		if (req.timestamp && now - req.timestamp > 60000) {
			loggedOutRequests.delete(id);
			continue;
		}
		if (url === req.url || url.startsWith(req.url)) {
			return true;
		}
	}
	return false;
}

const httpObserver = {
	observe: (subject, topic) => {
		try {
			if (topic === 'http-on-modify-request') {
				const httpChannel = subject.QueryInterface(Ci.nsIHttpChannel);
				const url = httpChannel.URI.spec;
				if (isLoggedOutRequest(url)) {
					try {
						const cookieHeader = httpChannel.getRequestHeader('Cookie');
						if (cookieHeader) {
							const filteredCookies = cookieHeader
								.split(/;\s*/)
								.filter((c) => !c.trim().toLowerCase().startsWith('phpsessid='))
								.join('; ');

							if (filteredCookies) {
								httpChannel.setRequestHeader('Cookie', filteredCookies, false);
							} else {
								httpChannel.setRequestHeader('Cookie', '', false);
								httpChannel.loadFlags |= Ci.nsIRequest.LOAD_ANONYMOUS;
							}
						} else {
							httpChannel.loadFlags |= Ci.nsIRequest.LOAD_ANONYMOUS;
						}
					} catch (e) {
						httpChannel.loadFlags |= Ci.nsIRequest.LOAD_ANONYMOUS;
					}
				}
			} else if (
				topic === 'http-on-examine-response' ||
				topic === 'http-on-examine-cached-response' ||
				topic === 'http-on-examine-merged-response'
			) {
				const httpChannel = subject.QueryInterface(Ci.nsIHttpChannel);
				const url = httpChannel.URI.spec;
				if (isLoggedOutRequest(url)) {
					try {
						httpChannel.setResponseHeader('Set-Cookie', '', false);
					} catch (e) {}
				}
			}
		} catch (e) {
			Cu.reportError('[ESGST] httpObserver error: ' + e);
		}
	},
};

function addHttpObserver() {
	if (hasAddedHttpObserver) return;
	hasAddedHttpObserver = true;
	Services.obs.addObserver(httpObserver, 'http-on-modify-request', false);
	Services.obs.addObserver(httpObserver, 'http-on-examine-response', false);
	Services.obs.addObserver(httpObserver, 'http-on-examine-cached-response', false);
	Services.obs.addObserver(httpObserver, 'http-on-examine-merged-response', false);
}

RequestQueue.getLastRequest = (key) => {
	return lastRequests[key] ?? 0;
};

RequestQueue.setLastRequest = (key, lastRequest) => {
	lastRequests[key] = lastRequest;
};

RequestQueue.getRequestThresholds = async () => {
	const values = await handle_storage(TYPE_GET, { settings: '{}' });
	const settings = JSON.parse(values.settings);
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
	const values = await handle_storage(TYPE_GET, { requestLog: '[]' });
	return JSON.parse(values.requestLog);
};

const loadStorage = () => handle_storage(TYPE_GET, null).then((result) => (storage = result));

function initializeOnDOMReady() {
	load();
	window.document.removeEventListener('DOMContentLoaded', initializeOnDOMReady);
}

if (window.document.readyState === 'loading') {
	window.document.addEventListener('DOMContentLoaded', initializeOnDOMReady);
} else {
	load();
}

function load() {
	RequestQueue.init();

	// @ts-ignore
	buttons.ActionButton({
		id: 'esgst',
		label: 'ESGST',
		icon: {
			'16': './icon-16.png',
			'32': './icon-32.png',
			'64': './icon-64.png',
		},
		onClick: handleClick,
	});

	loadStorage().then(async () => {
		const settings = storage.settings ? JSON.parse(storage.settings) : {};
		scheduleUpdateChecks(settings);
		if (!settings.activateTab_sg && !settings.activateTab_st) {
			return;
		}
		// Get the currently active tab.
		// @ts-ignore
		const currentTab = tabs.activeTab;
		if (settings.activateTab_sg) {
			// Set the SG tab as active.
			activateTab('steamgifts');
		}
		if (settings.activateTab_st) {
			// Set the ST tab as active.
			activateTab('steamtrades');
		}
		// Go back to the previously active tab.
		if (currentTab && currentTab.id) {
			currentTab.activate();
		}
	});

	// @ts-ignore
	PageMod({
		include: ['*.steamgifts.com', '*.steamtrades.com'],
		// @ts-ignore
		contentScriptFile: data.url('esgst.js'),
		contentScriptWhen: 'start',
		onAttach: (worker) => {
			let parameters;

			workers.add(worker);

			worker.on('detach', () => {
				detachWorker(worker);
			});

			worker.port.on('get-tds', async (request) => {
				const values = await handle_storage(TYPE_GET, { tdsData: '[]' });
				tdsData = JSON.parse(values.tdsData);
				worker.port.emit(`get-tds_${request.uuid}_response`, JSON.stringify(tdsData));
			});

			worker.port.on('notify-tds', async (request) => {
				tdsData = JSON.parse(request.data);
				await handle_storage(TYPE_SET, { tdsData: JSON.stringify(tdsData) });

				sendMessage('notify-tds', null, tdsData, true);

				worker.port.emit(`notify-tds_${request.uuid}_response`, 'null');
			});

			worker.port.on('permissions_contains', (request) => {
				worker.port.emit(`permissions_contains_${request.uuid}_response`, 'true');
			});

			worker.port.on('getBrowserInfo', (request) => {
				worker.port.emit(`getBrowserInfo_${request.uuid}_response`, `{ "name": "?" }`);
			});

			worker.port.on('queue_request', async (request) => {
				await RequestQueue.enqueue(request.key);
				worker.port.emit(`queue_request_${request.uuid}_response`, 'null');
			});

			worker.port.on('do_lock', async (request) => {
				const result = await do_lock(JSON.parse(request.lock));
				worker.port.emit(`do_lock_${request.uuid}_response`, result);
			});

			worker.port.on('update_lock', (request) => {
				update_lock(JSON.parse(request.lock));
				worker.port.emit(`update_lock_${request.uuid}_response`, 'null');
			});

			worker.port.on('do_unlock', (request) => {
				do_unlock(JSON.parse(request.lock));
				worker.port.emit(`do_unlock_${request.uuid}_response`, 'null');
			});

			worker.port.on('delValues', async (request) => {
				const keys = JSON.parse(request.keys);
				await handle_storage(TYPE_DEL, keys);
				worker.port.emit(`delValues_${request.uuid}_response`, 'null');
				const changes = {};
				for (const key of keys) {
					changes[key] = {
						newValue: 'null',
					};
				}
				sendMessage('storageChanged', worker, { changes, areaName: 'local' });
			});

			worker.port.on('start_logged_out_fetch', (request) => {
				addHttpObserver();
				const requestId = ++nextLoggedOutRequestId;
				loggedOutRequests.set(requestId, {
					url: request.url,
					worker,
					timestamp: Date.now(),
				});
				worker.port.emit(
					`start_logged_out_fetch_${request.uuid}_response`,
					{ success: true, requestId }
				);
			});

			worker.port.on('end_logged_out_fetch', (request) => {
				loggedOutRequests.delete(request.requestId);
				worker.port.emit(
					`end_logged_out_fetch_${request.uuid}_response`,
					{ success: true }
				);
			});

			worker.port.on('fetch', async (request) => {
				parameters = JSON.parse(request.parameters);
				const response = await doFetch(parameters, request);
				worker.port.emit(`fetch_${request.uuid}_response`, response);
			});

			worker.port.on('getPackageJson', (request) => {
				// @ts-ignore
				worker.port.emit(`getPackageJson_${request.uuid}_response`, JSON.stringify(typeof packageJson !== 'undefined' ? packageJson : {}));
			});

			worker.port.on('getStorage', async (request) => {
				const storage = await handle_storage(TYPE_GET, null);
				worker.port.emit(`getStorage_${request.uuid}_response`, JSON.stringify(storage));
			});

			worker.port.on('reload', (request) => {
				worker.port.emit(`reload_${request.uuid}_response`, 'null');
			});

			worker.port.on('setValues', async (request) => {
				const values = JSON.parse(request.values);
				await handle_storage(TYPE_SET, values);
				if (values.settings) scheduleUpdateChecks(JSON.parse(values.settings));
				worker.port.emit(`setValues_${request.uuid}_response`, 'null');
				const changes = {};
				for (const key in values) {
					changes[key] = {
						newValue: values[key],
					};
				}
				sendMessage('storageChanged', worker, { changes, areaName: 'local' });
			});

			worker.port.on('tabs', (request) => {
				getTabs(request);
				worker.port.emit(`tabs_${request.uuid}_response`, 'null');
			});

			worker.port.on('open_tab', (request) => {
				tabs.open(request.url);
				worker.port.emit(`open_tab_${request.uuid}_response`, 'null');
			});

			worker.port.on('register_tab', async (request) => {
				workerUrls.set(worker, request.url);
				worker.port.emit(`register_tab_${request.uuid}_response`, 'null');
				deliverPendingUpdate(worker).catch((err) => Cu.reportError('[ESGST] deliverPendingUpdate error: ' + err));
			});

			worker.port.on('pendingUpdateCheck', async (request) => {
				worker.port.emit(`pendingUpdateCheck_${request.uuid}_response`, 'null');
				deliverPendingUpdate(worker).catch((err) => Cu.reportError('[ESGST] deliverPendingUpdate error: ' + err));
			});

			worker.port.on('manualCheckVersion', async (request) => {
				const result = await checkRemoteVersion();
				const action = result.isNewVersion
					? 'showUpdatePopup'
					: result.latestVersion
						? 'showUpToDatePopup'
						: 'showUpdateCheckFailed';
				sendUpdateMessage(worker, action, result);
				worker.port.emit(`manualCheckVersion_${request.uuid}_response`, JSON.stringify(result));
			});

			worker.port.on('dismissUpdateNotification', async (request) => {
				try {
					const values = await handle_storage(TYPE_GET, { updateCheckState: '{}' });
					const updateCheckState = JSON.parse(values.updateCheckState || '{}');
					delete updateCheckState.pendingUpdateNotification;
					await handle_storage(TYPE_SET, { updateCheckState: JSON.stringify(updateCheckState) });
				} catch (e) {
					Cu.reportError('[ESGST] Error dismissing update notification: ' + e);
				}
				worker.port.emit(`dismissUpdateNotification_${request.uuid}_response`, 'null');
			});

			worker.port.on('update_adareqlim', async (request) => {
				await RequestQueue.loadRequestThreshold();
				worker.port.emit(`update_adareqlim_${request.uuid}_response`, 'null');
			});
		},
	});
}

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
	if (settings && settings.notifyNewVersion_sg) urls.push('https://www.steamgifts.com');
	if (settings && settings.notifyNewVersion_st) urls.push('https://www.steamtrades.com');
	return urls;
}

function scheduleUpdateChecks(settings) {
	if (updateCheckTimer) {
		clearTimeout(updateCheckTimer);
		updateCheckTimer = null;
	}
	if (!settings || (!settings.notifyNewVersion_sg && !settings.notifyNewVersion_st)) return;

	const intervalDays = Math.max(1, Number(settings.updateCheckInterval) || 7);
	const period = intervalDays * 24 * 60 * 60 * 1000;

	updateCheckTimer = setTimeout(function () {
		checkRemoteVersion()
			.then(function (result) {
				if (result && result.isNewVersion) {
					return notifyAboutUpdate(result.currentVersion, result.latestVersion);
				}
			})
			.catch(function (err) {
				Cu.reportError('[ESGST] Update check failed: ' + err);
			})
			.then(function () {
				return handle_storage(TYPE_GET, { settings: '{}' });
			})
			.then(function (values) {
				if (values && values.settings) {
					scheduleUpdateChecks(JSON.parse(values.settings));
				}
			})
			.catch(function (err) {
				Cu.reportError('[ESGST] Reschedule failed: ' + err);
			});
	}, period);
}

function checkRemoteVersion() {
	return new Promise((resolve) => {
		const currentVersion = typeof packageJson !== 'undefined' && packageJson ? packageJson.version : '0.0.0';

		try {
			Request({
				url: 'https://api.github.com/repos/SquishedPotatoe/esgst/tags?per_page=100',
				headers: {
					'User-Agent': 'ESGST-Extension',
				},
				onComplete: function (response) {
					try {
						if (response.status >= 200 && response.status < 300) {
							const tags = response.json || JSON.parse(response.text);
							const versions = tags
								.map(function (tag) {
									const match = /^v(\d+\.\d+\.\d+)$/.exec(tag.name);
									return match ? match[1] : null;
								})
								.filter(Boolean);

							const latestVersion = versions.reduce(function (latest, version) {
								return !latest || isNewerVersion(version, latest) ? version : latest;
							}, null);

							const isNew = !!latestVersion && isNewerVersion(latestVersion, currentVersion);
							resolve({ currentVersion, latestVersion, isNewVersion: isNew });
						} else {
							resolve({ currentVersion, latestVersion: null, isNewVersion: false });
						}
					} catch (e) {
						resolve({ currentVersion, latestVersion: null, isNewVersion: false });
					}
				},
			}).get();
		} catch (e) {
			resolve({ currentVersion, latestVersion: null, isNewVersion: false });
		}
	});
}

function sendUpdateMessage(worker, action, values) {
	worker.port.emit('esgstMessage', JSON.stringify({ action, values }));
}

async function notifyAboutUpdate(currentVersion, latestVersion) {
	const values = await handle_storage(TYPE_GET, { settings: '{}', updateCheckState: '{}' });
	const settings = JSON.parse(values.settings || '{}');
	const updateCheckState = JSON.parse(values.updateCheckState || '{}');
	if (updateCheckState.lastNotifiedVersion === latestVersion) return;

	const state = { ...updateCheckState, lastNotifiedVersion: latestVersion };
	const urls = getUpdateUrls(settings);
	const matchingWorkers = Array.from(workers).filter((worker) =>
		urls.some((url) => workerUrls.get(worker)?.startsWith(url))
	);
	if (matchingWorkers.length) {
		for (const worker of matchingWorkers) {
			sendUpdateMessage(worker, 'showUpdatePopup', { currentVersion, latestVersion });
		}
		delete state.pendingUpdateNotification;
	} else {
		state.pendingUpdateNotification = latestVersion;
	}
	await handle_storage(TYPE_SET, { updateCheckState: JSON.stringify(state) });
}

async function deliverPendingUpdate(worker) {
	const workerUrl = workerUrls.get(worker);
	if (!workerUrl) return;

	const values = await handle_storage(TYPE_GET, { settings: '{}', updateCheckState: '{}' });
	const settings = JSON.parse(values.settings || '{}');
	const updateCheckState = JSON.parse(values.updateCheckState || '{}');
	if (!updateCheckState.pendingUpdateNotification) return;

	const allowedUrls = getUpdateUrls(settings);
	if (!allowedUrls.some((url) => workerUrl.startsWith(url))) return;

	const currentVersion = typeof packageJson !== 'undefined' && packageJson ? packageJson.version : '0.0.0';
	sendUpdateMessage(worker, 'showUpdatePopup', {
		currentVersion,
		latestVersion: updateCheckState.pendingUpdateNotification,
	});
	delete updateCheckState.pendingUpdateNotification;
	await handle_storage(TYPE_SET, { updateCheckState: JSON.stringify(updateCheckState) });
}

function handleClick(state) {
	// @ts-ignore
	tabs.open('https://www.steamgifts.com/account/settings/profile?esgst=settings');
}

function handle_storage(operation, values) {
	return new Promise((resolve) => {
		// @ts-ignore
		const dbConn = Services.storage.openDatabase(file);
		dbConn.executeSimpleSQL(`CREATE TABLE IF NOT EXISTS esgst (key TEXT NOT NULL, value TEXT)`);
		dbConn.executeSimpleSQL(`CREATE UNIQUE INDEX IF NOT EXISTS idx_esgst_key ON esgst (key)`);
		const statements = [];
		switch (operation) {
			case TYPE_SET: {
				const stmt = dbConn.createStatement(
					`INSERT OR REPLACE INTO esgst (key, value) VALUES (:key, :value)`
				);
				const params = stmt.newBindingParamsArray();
				for (const key in values) {
					const bp = params.newBindingParams();
					bp.bindByName('key', key);
					bp.bindByName('value', values[key]);
					params.addParams(bp);
				}
				stmt.bindParameters(params);
				statements.push(stmt);
				break;
			}
			case TYPE_GET: {
				if (values) {
					const stmt = dbConn.createStatement(
						`INSERT OR IGNORE INTO esgst (key, value) VALUES (:key, :value)`
					);
					const params = stmt.newBindingParamsArray();
					for (const key in values) {
						const bp = params.newBindingParams();
						bp.bindByName('key', key);
						bp.bindByName('value', values[key]);
						params.addParams(bp);
					}
					stmt.bindParameters(params);
					statements.push(stmt);
					const conditions = [];
					let i = 0;
					const n = Object.keys(values).length;
					while (i < n) {
						conditions.push(`key = :key${i++}`);
					}
					const select_stmt = dbConn.createStatement(
						`SELECT * FROM esgst WHERE ${conditions.join(' OR ')}`
					);
					i = 0;
					for (const key in values) {
						select_stmt.params[`key${i}`] = key;
					}
					statements.push(select_stmt);
				} else {
					const select_stmt = dbConn.createStatement('SELECT * FROM esgst');
					statements.push(select_stmt);
				}
				break;
			}
			case TYPE_DEL: {
				const conditions = [];
				let i = 0;
				const n = values.length;
				while (i < n) {
					conditions.push(`key = :key${i++}`);
				}
				const stmt = dbConn.createStatement(`DELETE FROM esgst WHERE ${conditions.join(' OR ')}`);
				i = 0;
				for (const key of values) {
					stmt.params[`key${i}`] = key;
				}
				statements.push(stmt);
				break;
			}
		}
		const output = {};
		dbConn.executeAsync(statements, statements.length, {
			handleCompletion: (aReason) => {},
			handleError: (aError) => {},
			handleResult: (aResultSet) => {
				let row;
				do {
					row = aResultSet.getNextRow();
					if (row) {
						output[row.getResultByName('key')] = row.getResultByName('value');
					}
				} while (row);
			},
		});
		dbConn.asyncClose(() => resolve(output));
	});
}

function sendMessage(action, sender, values, sendToAll) {
	for (const worker of workers) {
		if (sender && worker === sender) {
			continue;
		}
		worker.port.emit('esgstMessage', JSON.stringify({ action, values }));
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
		type: 'uint8array',
	});
}

async function readZip(data) {
	const zip = new JSZip(),
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

function doFetch(parameters, request) {
	return new Promise(async (resolve) => {
		let loggedOutId = null;
		if (request.loggedOut) {
			addHttpObserver();
			loggedOutId = ++nextLoggedOutRequestId;
			loggedOutRequests.set(loggedOutId, {
				url: request.url,
				timestamp: Date.now(),
			});
		}

		try {
			if (request.fileName) {
				parameters.body = await getZip(parameters.body, request.fileName);
			}

			const isSgStRequest = /.*:\/\/(.*\.)?(steamgifts|steamtrades)\.com\/.*/.test(request.url);

			const performXhr = (url, opts) => {
				return new Promise((xhrResolve, xhrReject) => {
					const xhr = Cc['@mozilla.org/xmlextras/xmlhttprequest;1'].createInstance(Ci.nsIXMLHttpRequest);
					const method = (opts.method || 'GET').toUpperCase();
					xhr.open(method, url, true);

					if (request.timeout) {
						xhr.timeout = request.timeout;
					}

					if (opts.headers) {
						for (const [key, val] of Object.entries(opts.headers)) {
							try {
								xhr.setRequestHeader(key, val);
							} catch (e) {}
						}
					}

					if (request.blob) {
						xhr.responseType = 'arraybuffer';
					}

					xhr.onload = () => {
						xhrResolve({
							status: xhr.status,
							url: xhr.responseURL || url,
							headers: xhr.getAllResponseHeaders(),
							responseText: request.blob ? xhr.response : xhr.responseText,
							ok: xhr.status >= 200 && xhr.status < 300,
						});
					};

					xhr.onerror = () => xhrReject(new TypeError('NetworkError when attempting to fetch resource.'));
					xhr.ontimeout = () => xhrReject(new TypeError('Request timed out.'));

					xhr.send(opts.body || null);
				});
			};

			let response = null;
			let responseText = null;

			try {
				response = await performXhr(request.url, parameters);

				const isCfBlocked =
					(response.status === 403 || response.status === 503) &&
					(response.headers.toLowerCase().includes('cloudflare') || isSgStRequest);

				if (isCfBlocked && (await resolveCloudflareChallenge(request.url))) {
					response = await performXhr(request.url, parameters);
				}

				if (request.blob) {
					const binaryString = String.fromCharCode.apply(null, new Uint8Array(response.responseText));
					responseText = (await readZip(binaryString))[0].value;
				} else {
					responseText = response.responseText;
				}

				if (!response.ok) {
					throw responseText;
				}
			} catch (error) {
				resolve(JSON.stringify({ error: typeof error === 'object' ? error.message || error : error }));
				return;
			}

			resolve(
				JSON.stringify({
					status: response.status,
					url: response.url,
					redirected: response.url !== request.url,
					text: responseText,
				})
			);
		} catch (err) {
			resolve(JSON.stringify({ error: err.message || err }));
		} finally {
			if (loggedOutId !== null) {
				loggedOutRequests.delete(loggedOutId);
			}
		}
	});
}

async function resolveCloudflareChallenge(targetUrl) {
	if (cfChallengePromise) return cfChallengePromise;

	cfChallengePromise = (async () => {
		try {
			const urlObj = new URL(targetUrl);
			const domain = urlObj.hostname.replace(/^www\./, '');

			return await new Promise((resolve) => {
				let temporaryTab = null;
				let timeoutId = null;

				const cleanup = () => {
					if (timeoutId) clearTimeout(timeoutId);
					Services.obs.removeObserver(cookieObserver, 'cookie-changed');
					cfChallengePromise = null;
				};

				const cookieObserver = {
					observe(subject, topic, data) {
						if (topic !== 'cookie-changed' || data === 'deleted') return;

						const cookie = subject.QueryInterface(Ci.nsICookie2);
						const cookieDomain = cookie.host.replace(/^\./, '');
						if (cookie.name !== 'cf_clearance' || !domain.endsWith(cookieDomain)) return;

						cleanup();
						if (temporaryTab) temporaryTab.close();
						resolve(true);
					},
				};

				Services.obs.addObserver(cookieObserver, 'cookie-changed', false);
				timeoutId = setTimeout(() => {
					cleanup();
					resolve(false);
				}, 120000);

				try {
					const existingTab = Array.from(workers)
						.map((worker) => worker.tab)
						.find((tab) => tab.url && tab.url.includes(domain));

					if (existingTab) {
						existingTab.activate();
						existingTab.reload();
					} else {
                        // @ts-ignore
						temporaryTab = tabs.open(`https://${urlObj.hostname}/`);
					}
				} catch (error) {
					console.error('[ESGST] Cloudflare challenge resolution failed', error);
					cleanup();
					resolve(false);
				}
			});
		} catch (error) {
			console.error('[ESGST] Cloudflare challenge resolution failed', error);
			cfChallengePromise = null;
			return false;
		}
	})();

	return cfChallengePromise;
}

async function detachWorker(worker) {
	//Cu.reportError(worker);
	workers.delete(worker);
	workerUrls.delete(worker);
	for (const [id, req] of loggedOutRequests.entries()) {
		if (req.worker === worker) {
			loggedOutRequests.delete(id);
		}
	}
}

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

function getTabs(request) {
	let items = [
		{
			id: 'inbox_sg',
			pattern: /.*:\/\/.*\.steamgifts\.com\/messages.*/,
			url: `https://www.steamgifts.com/messages`,
		},
		{
			id: 'inbox_st',
			pattern: /.*:\/\/.*\.steamtrades\.com\/messages.*/,
			url: `https://www.steamtrades.com/messages`,
		},
		{
			id: 'wishlist',
			pattern: /.*:\/\/.*\.steamgifts\.com\/giveaways\/search\?.*type=wishlist.*/,
			url: `https://www.steamgifts.com/giveaways/search?type=wishlist`,
		},
		{
			id: 'won',
			pattern: /.*:\/\/.*\.steamgifts\.com\/giveaways\/won.*/,
			url: `https://www.steamgifts.com/giveaways/won`,
		},
	];
	let any = false;
	for (let i = 0, n = items.length; i < n; i++) {
		let item = items[i];
		if (!request[item.id]) {
			continue;
		}
		let tab = Array.from(workers)
			.map((worker) => worker.tab)
			.filter((tab) => tab.url.match(item.pattern))[0];
		if (tab && tab.id) {
			tab.activate();
			if (request.refresh) {
				tab.reload();
			}
		} else if (request.any) {
			any = true;
		} else {
			// @ts-ignore
			tabs.open(item.url);
		}
	}
	if (any) {
		let tab = Array.from(workers)
			.map((worker) => worker.tab)
			.filter((tab) => tab.url.match(/.*:\/\/.*\.steamgifts\.com\/.*/))[0];
		if (tab && tab.id) {
			tab.activate();
		}
	}
}

function activateTab(host) {
	const tab = Array.from(workers)
		.map((worker) => worker.tab)
		.filter((tab) => tab.url.match(new RegExp(`.*:\\/\\/.*\\.${host}\\.com\\/.*`)))[0];
	if (tab && tab.id) {
		tab.activate();
	}
}
