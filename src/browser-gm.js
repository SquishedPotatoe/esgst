import { setBrowser } from './browser';
import { RequestQueue } from './class/Queue';
import { Shared } from './class/Shared';

let tdsData = [];
let cfChallengePromise = null;
let lastCfResolvedAt = 0;

const browser = {
	gm: null,
	runtime: {
		onMessage: {
			addListener: (callback) => (browser.gm.listener = callback),
		},
		getBrowserInfo: () => Promise.resolve({ name: 'userscript' }),
		getManifest: () => Promise.resolve(browser.gm.info.script),
		sendMessage: (obj) => {
			return new Promise(async (resolve) => {
				switch (obj.action) {
					case 'get-tds':
						tdsData = JSON.parse(await browser.gm.getValue('tdsData', '[]'));
						resolve(JSON.stringify(tdsData));

						break;
					case 'notify-tds':
						tdsData = JSON.parse(obj.data);
						await browser.gm.setValue('tdsData', JSON.stringify(tdsData));

						browser.gm.listener(
							JSON.stringify({
								action: 'notify-tds',
								values: tdsData,
							})
						);

						resolve();

						break;
					case 'permissions_contains':
						resolve(true);
						break;
					case 'getBrowserInfo': {
						const browserInfo = await browser.runtime.getBrowserInfo();
						resolve(JSON.stringify(browserInfo));
						break;
					}
					case 'queue_request': {
						await RequestQueue.enqueue(obj.key);
						resolve();
						break;
					}
					case 'do_lock': {
						const lock = JSON.parse(obj.lock);

						resolve(await browser.gm.doLock(lock));

						break;
					}
					case 'update_lock': {
						const lock = JSON.parse(obj.lock);
						const locked = JSON.parse(await browser.gm.getValue(lock.key, '{}'));
						if (locked.uuid === lock.uuid) {
							locked.timestamp = Date.now();
							await browser.gm.setValue(lock.key, JSON.stringify(locked));
						}
						resolve();
						break;
					}
					case 'do_unlock': {
						const lock = JSON.parse(obj.lock);
						await browser.gm.setValue(lock.key, '{}');
						resolve();
						break;
					}
					case 'fetch': {
						const parameters = JSON.parse(obj.parameters);

						if ((!parameters.method || parameters.method.toUpperCase() === 'GET') && parameters.headers) {
							delete parameters.headers['Content-Type'];
							delete parameters.headers['content-type'];
						}

						if (parameters.credentials === 'omit') {
							parameters.headers['Esgst-Cookie'] = '';
						}

						const request = {
							anonymous: false,
							binary: !!obj.fileName,
							data: obj.fileName
								? await Shared.common.getZip(parameters.body, obj.fileName, 'binarystring')
								: parameters.body,
							headers: parameters.headers,
							method: parameters.method || 'GET',
							overrideMimeType: obj.blob ? `text/plain; charset=x-user-defined` : '',
							timeout: obj.timeout ?? 10000,
							url: obj.url,
							onload: async (response) => {
								if (obj.blob) {
									response.responseText = (
										await Shared.common.readZip(response.responseText)
									)[0].value;
								}

								if (response.status === 403 || response.status === 503) {
									const rawHeaders = response.responseHeaders || '';

									const cfMitigated = rawHeaders
										.match(/(?:^|\r?\n)cf-mitigated:\s*([^\r\n]+)/i)?.[1]
										?.trim()
										.toLowerCase();

									const requestHost = (() => {
										try {
											return new URL(obj.url).hostname;
										} catch {
											return '';
										}
									})();

									const isSgStRequest = /(^|\.)steam(gifts|trades)\.com$/.test(requestHost);

									if (isSgStRequest && cfMitigated === 'challenge') {
										resolve({
											cfBlocked: true,
											url: obj.url,
										});
										return;
									}
								}
								resolve({
									status: response.status,
									url: response.finalUrl,
									redirected:
										typeof response.finalUrl !== 'undefined' && response.finalUrl !== obj.url,
									text: response.responseText,
								});
							},
							onerror: (response) => resolve({ error: response.responseText }),
						};

						if (obj.loggedOut) {
							if (!browser.gm.cookie?.list) {
								resolve({ error: 'Logged-out requests require GM.cookie support.' });
								break;
							}

							try {
								const [standardCookies, partitionedCookies] = await Promise.all([
									browser.gm.cookie.list({ url: obj.url }),
									browser.gm.cookie.list({ url: obj.url, partitionKey: {} }).catch(() => []),
								]);
								const cookieMap = new Map();
								for (const item of [...standardCookies, ...partitionedCookies]) {
									const key = [
										item.name,
										item.domain,
										item.path,
										item.partitionKey?.topLevelSite || '',
									].join('|');
									cookieMap.set(key, item);
								}
								const cookies = Array.from(cookieMap.values());
								const nonSessionCookies = cookies.filter((item) => item.name !== 'PHPSESSID');

								if (browser.gm.info.scriptHandler === 'Violentmonkey') {
									const phpCookies = cookies.filter((item) => item.name === 'PHPSESSID');

									for (const c of phpCookies) {
										await browser.gm.cookie.set({
											url: obj.url,
											name: 'PHPSESSID',
											value: 'invalid_session_id',
											domain: c.domain,
											path: c.path,
											secure: c.secure,
											httpOnly: c.httpOnly,
										});
									}

									const restoreCookies = async () => {
										for (const c of phpCookies) {
											await browser.gm.cookie.set({
												url: obj.url,
												name: c.name,
												value: c.value,
												domain: c.domain,
												path: c.path,
												secure: c.secure,
												httpOnly: c.httpOnly,
												expirationDate: c.expirationDate,
											});
										}
									};

									const vmRequest = {
										...request,
										onload: async (response) => {
											await restoreCookies();
											await request.onload(response);
										},
										onerror: async (response) => {
											await restoreCookies();
											request.onerror(response);
										},
										onabort: async (response) => {
											await restoreCookies();
											if (request.onabort) request.onabort(response);
											else resolve({ error: 'Request aborted' });
										},
										ontimeout: async (response) => {
											await restoreCookies();
											if (request.ontimeout) request.ontimeout(response);
											else resolve({ error: 'Request timed out' });
										},
									};

									browser.gm.xmlHttpRequest(vmRequest);
									break;
								} else {
									const cookieString = nonSessionCookies.map((item) => `${item.name}=${item.value}`).join('; ');
									request.cookie = ['PHPSESSID=', cookieString].filter(Boolean).join('; ');
								}
							} catch (error) {
								resolve({ error: error?.message || String(error) });
								break;
							}
						}

						browser.gm.xmlHttpRequest(request);
						break;
					}
					case 'open_tab': {
						browser.gm.openInTab(obj.url, false);
						resolve();
						break;
					}
					case 'register_tab': {
						try {
							const hostname = (() => {
								try {
									return new URL(obj.url)
										.hostname
										.replace(/^www\./, '');
								} catch {
									return '';
								}
							})();

							if (hostname) {
								const resolvingKey = `esgst_cfResolving_${hostname}`;
								const resolvedKey = `esgst_cfResolved_${hostname}`;

								const resolvingRaw = await browser.gm.getValue(
									resolvingKey,
									''
								);

								if (resolvingRaw) {
									const resolving = JSON.parse(resolvingRaw);

									if (
										resolving?.timestamp &&
										Date.now() - resolving.timestamp < 130000
									) {
										await browser.gm.setValue(
											resolvedKey,
											JSON.stringify(Date.now())
										);

										await browser.gm.setValue(
											resolvingKey,
											''
										);

										resolve({
											cfChallengeSolved: true,
										});
										break;
									}
								}
							}
						} catch (e) { }

						resolve();
						break;
					}
					case 'resolve_cf_challenge': {
						if (Date.now() - lastCfResolvedAt < 70000) {
							resolve({ success: false });
							break;
						}

						if (cfChallengePromise) {
							resolve(await cfChallengePromise);
							break;
						}

						cfChallengePromise = (async () => {
							try {
								const urlObj = new URL(
									obj.url,
									'https://www.steamgifts.com'
								);
								const domain = urlObj.hostname.replace(/^www\./, '');
								const challengeUrl = `https://${urlObj.hostname}/`;
								const resolvingKey = `esgst_cfResolving_${domain}`;
								const resolvedKey = `esgst_cfResolved_${domain}`;

								return await new Promise((resolveInner) => {
									let tab = null;
									let timeoutId = null;
									let listenerId = null;

									const cleanup = async () => {
										if (timeoutId) {
											clearTimeout(timeoutId);
											timeoutId = null;
										}

										if (
											listenerId !== null &&
											browser.gm.removeValueChangeListener
										) {
											try {
												await browser.gm.removeValueChangeListener(
													listenerId
												);
											} catch { }
											listenerId = null;
										}

										try {
											await browser.gm.setValue(
												resolvingKey,
												''
											);
										} catch { }

										cfChallengePromise = null;
									};

									(async () => {
										try {
											listenerId = await browser.gm.addValueChangeListener(
												resolvedKey,
												async (name, oldValue, newValue, remote) => {
													if (!remote || !newValue) return;

													const tabRef = tab;

													await cleanup();

													if (tabRef) {
														try {
															tabRef.close();
														} catch { }
													}

													lastCfResolvedAt = Date.now();
													resolveInner({ success: true });
												}
											);
										} catch (e) {
											console.error(
												'[ESGST] CF challenge: addValueChangeListener failed',
												e
											);
										}

										try {
											await browser.gm.setValue(
												resolvingKey,
												JSON.stringify({
													url: challengeUrl,
													timestamp: Date.now(),
												})
											);
										} catch (e) {
											console.error(
												'[ESGST] CF challenge: setValue(resolvingKey) failed',
												e
											);
										}

										try {
											tab = browser.gm.openInTab(challengeUrl, {
												active: true,
												insert: true,
											});
										} catch (e) {
											console.error(
												'[ESGST] CF challenge: openInTab failed',
												e
											);
											await cleanup();
											resolveInner({ success: false });
											return;
										}

										timeoutId = setTimeout(async () => {
											const tabRef = tab;

											await cleanup();

											if (tabRef) {
												try {
													tabRef.close();
												} catch { }
											}

											resolveInner({ success: false });
										}, 120000);
									})();
								});
							} catch (error) {
								console.error(
									'[ESGST] Cloudflare challenge resolution failed',
									error
								);
								cfChallengePromise = null;
								return { success: false };
							}
						})();

						resolve(await cfChallengePromise);
						break;
					}
					case 'update_adareqlim': {
						await RequestQueue.loadRequestThreshold();
						resolve();
						break;
					}
				}
			});
		},
	},
	storage: {
		local: {
			get: async () => {
				const keys = await browser.gm.listValues();
				const promises = [];
				const storage = {};
				for (const key of keys) {
					const promise = browser.gm.getValue(key);
					promise.then((value) => (storage[key] = value));
					promises.push(promise);
				}
				await Promise.all(promises);

				return storage;
			},
			remove: async (keys) => {
				const promises = [];
				for (const key of keys) {
					promises.push(browser.gm.deleteValue(key));
				}
				await Promise.all(promises);
				await browser.gm.setValue('storageChanged', JSON.stringify(Date.now()));
			},
			set: async (values) => {
				const promises = [];
				for (const key in values) {
					if (values.hasOwnProperty(key)) {
						promises.push(browser.gm.setValue(key, values[key]));
					}
				}
				await Promise.all(promises);
				await browser.gm.setValue('storageChanged', JSON.stringify(Date.now()));
			},
		},
		onChanged: {
			addListener: () => {},
		},
	},
};

browser.gm = GM;
browser.gm.lastUpdate = 0;

const lastRequests = {};

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

if (!browser.gm.addValueChangeListener) {
	browser.gm.hasValueChanged = async (key, oldValue, callback) => {
		const newValue = await browser.gm.getValue(key);
		if (newValue !== oldValue) {
			callback(key, oldValue, newValue, true);
			oldValue = newValue;
		}
		window.setTimeout(browser.gm.hasValueChanged, 5000, key, oldValue, callback);
	};
	browser.gm.addValueChangeListener = async (key, callback) => {
		const oldValue = await browser.gm.getValue(key);
		browser.gm.hasValueChanged(key, oldValue, callback);
	};
}

browser.gm.addValueChangeListener('storageChanged', async (name, oldValue, newValue, remote) => {
	if (!remote || !newValue || newValue === 'undefined') {
		return;
	}
	const lastUpdate = JSON.parse(newValue);
	if (lastUpdate > browser.gm.lastUpdate) {
		browser.gm.lastUpdate = lastUpdate;

		const storage = await browser.storage.local.get(null);
		const changes = {};
		for (const key in storage) {
			changes[key] = {
				newValue: storage[key],
			};
		}
		browser.gm.listener(
			JSON.stringify({
				action: 'storageChanged',
				values: { changes, areaName: 'local' },
			})
		);
	}
});

browser.gm.doLock = async (lock) => {
	let locked = JSON.parse(await browser.gm.getValue(lock.key, '{}'));
	if (!locked || !locked.uuid || locked.timestamp < Date.now() - (lock.threshold + lock.timeout)) {
		await browser.gm.setValue(
			lock.key,
			JSON.stringify({
				timestamp: Date.now(),
				uuid: lock.uuid,
			})
		);
		await Shared.common.timeout(lock.threshold / 2);
		locked = JSON.parse(await browser.gm.getValue(lock.key, '{}'));
		if (!locked || locked.uuid !== lock.uuid) {
			if (!lock.tryOnce) {
				return browser.gm.doLock(lock);
			}

			return 'false';
		}

		return 'true';
	}

	if (!lock.tryOnce) {
		await Shared.common.timeout(lock.threshold / 3);
		return browser.gm.doLock(lock);
	}

	return 'false';
};

setBrowser(browser);
