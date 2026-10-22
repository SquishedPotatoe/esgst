import { browser } from '../browser';
import { Utils } from '../lib/jsUtils';
import { DOM } from './DOM';
import { Lock } from './Lock';
import { Settings } from './Settings';
import { Shared } from './Shared';

export interface FetchOptions {
	method: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';
	headers?: Record<string, string>;
	data?: BodyInit;
	pathParams?: Record<string, string>;
	queryParams?: Record<string, string>;
	queue?: boolean | number;
	doNotQueue?: boolean;
	timeout?: number;
	anon?: boolean;
	loggedOut?: boolean;
	blob?: string;
	fileName?: string;
}

export interface FetchResponse {
	status: number;
	url: string;
	redirected: boolean;
	text: string;
	json?: Record<string, unknown> | null;
	html?: Document | null;
}

export class FetchRequest {
	static readonly DEFAULT_HEADERS = {
		'Content-Type': 'application/x-www-form-urlencoded',
	};
	static readonly REQUIRED_HEADERS = {
		'Esgst-Version': '',
		From: 'esgst.extension@gmail.com',
	};

	private static _env: Promise<{
		isUserscript: boolean;
		isFirefox: boolean;
		isTampermonkey: boolean;
		httpOnlySupport: boolean;
	}> | null = null;

	private static getEnv() {
		if (!FetchRequest._env) {
			FetchRequest._env = (async () => {
				const [tampermonkeyMajor, tampermonkeyMinor] = (browser.gm?.info?.version || '0.0').split('.').map(Number);
				const isTampermonkey = browser.gm?.info?.scriptHandler === 'Tampermonkey';
				const browserInfo = await Shared.common.getBrowserInfo();
				return {
					isUserscript: browserInfo.name === 'userscript',
					isFirefox: browserInfo.name === 'Firefox',
					isTampermonkey,
					httpOnlySupport:
						isTampermonkey &&
						(tampermonkeyMajor > 5 || (tampermonkeyMajor === 5 && tampermonkeyMinor >= 6)),
				};
			})();
		}
		return FetchRequest._env;
	}

	static async getLoggedOutOptions(): Promise<Pick<FetchOptions, 'anon' | 'loggedOut'>> {
		const { httpOnlySupport } = await FetchRequest.getEnv();
		return httpOnlySupport ? { loggedOut: true } : { anon: true };
	}

	static delete(url: string, options: Partial<FetchOptions> = {}): Promise<FetchResponse> {
		return FetchRequest.send(url, { ...options, method: 'DELETE' });
	}

	static get(url: string, options: Partial<FetchOptions> = {}): Promise<FetchResponse> {
		return FetchRequest.send(url, { ...options, method: 'GET' });
	}

	static patch(url: string, options: Partial<FetchOptions> = {}): Promise<FetchResponse> {
		return FetchRequest.send(url, { ...options, method: 'PATCH' });
	}

	static post(url: string, options: Partial<FetchOptions> = {}): Promise<FetchResponse> {
		return FetchRequest.send(url, { ...options, method: 'POST' });
	}

	static put(url: string, options: Partial<FetchOptions> = {}): Promise<FetchResponse> {
		return FetchRequest.send(url, { ...options, method: 'PUT' });
	}

	static async send(url: string, options: FetchOptions): Promise<FetchResponse> {
		if (!FetchRequest.REQUIRED_HEADERS['Esgst-Version']) {
			FetchRequest.REQUIRED_HEADERS['Esgst-Version'] = Shared.esgst.currentVersion;
		}

		let response = null;
		let lock = null;
		let loggedOutRequestId: number | null = null;
		const { isUserscript, isTampermonkey } = await FetchRequest.getEnv();

		url = url
			.replace(/^\//, `https://${window.location.hostname}/`)
			.replace(/^https?:/, Shared.esgst.locationHref.match(/^http:/) ? 'http:' : 'https:');
		if (options.pathParams) {
			url = FetchRequest.addPathParams(url, options.pathParams);
		}
		if (options.queryParams) {
			url = FetchRequest.addQueryParams(url, options.queryParams);
		}
		options.headers = {
			...FetchRequest.DEFAULT_HEADERS,
			...options.headers,
			...FetchRequest.REQUIRED_HEADERS,
		};

		try {
			const isInternal = url.match(new RegExp(window.location.hostname));
			if (options.queue) {
				lock = new Lock('request', {
					threshold: typeof options.queue === 'number' ? options.queue : 1000,
				});
			} else if (isInternal && !options.doNotQueue) {
				await browser.runtime.sendMessage({
					action: 'queue_request',
					key: 'sg',
				});
			} else if (
				url.match(/^https?:\/\/store.steampowered.com/) &&
				Settings.get('limitSteamStore')
			) {
				lock = new Lock('steamStore', { threshold: 200 });
			}

			if (lock) {
				await lock.lock();
			}

			if (options.loggedOut && !isUserscript) {
				if (!isInternal) {
					throw new Error('Logged-out requests are only supported for the current site');
				}

				let res = await browser.runtime.sendMessage({
					action: 'start_logged_out_fetch',
					url,
				});
				if (typeof res === 'string') {
					try {
						res = JSON.parse(res);
					} catch (e) {}
				}
				if (!res?.success || !Number.isInteger(res.requestId)) {
					throw new Error(`Could not start logged-out request: ${res?.error || 'unknown error'}`);
				}
				loggedOutRequestId = res.requestId;
			}

			try {
				if (isInternal && !(isUserscript && options.loggedOut)) {
					response = await FetchRequest.sendInternal(url, options);
				} else {
					response = await FetchRequest.sendExternal(url, options);
				}
			} catch (err: any) {
				if (!err?.cfBlocked) {
					throw err;
				}
				if (isUserscript && (!isTampermonkey || !(await FetchRequest.getEnv()).httpOnlySupport)) {
					throw new Error('Cloudflare challenge is unavailable');
				}

				if (loggedOutRequestId !== null) {
					await browser.runtime
						.sendMessage({ action: 'end_logged_out_fetch', requestId: loggedOutRequestId })
						.catch(() => { });
					loggedOutRequestId = null;
				}

				let cfRes = await browser.runtime
					.sendMessage({ action: 'resolve_cf_challenge', url })
					.catch(() => null);

				if (typeof cfRes === 'string') {
					try {
						cfRes = JSON.parse(cfRes);
					} catch (e) { }
				}

				if (!cfRes?.success) {
					throw new Error('Cloudflare challenge could not be resolved');
				}

				if (options.loggedOut && !isUserscript) {
					let res = await browser.runtime.sendMessage({
						action: 'start_logged_out_fetch',
						url,
					});

					if (typeof res === 'string') {
						try {
							res = JSON.parse(res);
						} catch (e) { }
					}

					if (!res?.success || !Number.isInteger(res.requestId)) {
						throw new Error(`Could not restart logged-out request: ${res?.error || 'unknown error'}`);
					}
					loggedOutRequestId = res.requestId;
				}

				if (isInternal && !(isUserscript && options.loggedOut)) {
					response = await FetchRequest.sendInternal(url, options);
				} else {
					response = await FetchRequest.sendExternal(url, options);
				}
			}

			if (isInternal) {
				Shared.esgst.requestLog.unshift({
					url,
					timestamp: Date.now(),
				});
				if (response.redirected) {
					Shared.esgst.requestLog.unshift({
						url: response.url,
						timestamp: Date.now(),
					});
				}
				await Shared.common.setValue('requestLog', JSON.stringify(Shared.esgst.requestLog));
			}

			if (lock) {
				await lock.unlock();
			}

			response.json = null;
			response.html = null;
			try {
				response.json = JSON.parse(response.text);
			} catch (err) {}
			if (!response.json) {
				try {
					response.html = DOM.parse(response.text);
				} catch (err) {}
			}

			if (response.url.match(/www.steamgifts.com/) && response.html) {
				Shared.common.lookForPopups(response);
			}

			return response;
		} catch (err) {
			if (lock) {
				await lock.unlock();
			}

			throw err;
		} finally {
			if (loggedOutRequestId !== null) {
				await browser.runtime
					.sendMessage({ action: 'end_logged_out_fetch', requestId: loggedOutRequestId })
					.catch(() => { });
			}
		}
	}

	static async sendInternal(url: string, options: FetchOptions): Promise<FetchResponse> {
		const { fetchObj, fetchOptions, abortController } = await FetchRequest.getFetchObj(options);

		const { timeout = 10000 } = options;
		const timeoutId = window.setTimeout(() => abortController.abort(), timeout);
		const { isUserscript: isscript, isTampermonkey } = await FetchRequest.getEnv();
		fetchOptions.signal = abortController.signal;

		let response: Response;

		try {
			response = await fetchObj(url, fetchOptions);
		} finally {
			window.clearTimeout(timeoutId);
		}

		if (response.status === 403 || response.status === 503) {
			if (isscript && (!isTampermonkey || !(await FetchRequest.getEnv()).httpOnlySupport)) {
				throw new Error(`Request failed with status ${response.status} (Cloudflare challenge unavailable)`);
			} else {
				const cfMitigated = response.headers.get('cf-mitigated')?.toLowerCase();

				if (cfMitigated === 'challenge') {
					throw Object.assign(new Error('CF_BLOCKED'), { cfBlocked: true, url });
				}
			}
		}

		const text = await response.text();

		if (!response.ok) {
			throw new Error(text);
		}

		return {
			status: response.status,
			url: response.url,
			redirected: response.redirected,
			text,
		};
	}

	static async sendExternal(url: string, options: FetchOptions): Promise<FetchResponse> {
		const { isFirefox } = await FetchRequest.getEnv();
		const manipulateCookies = isFirefox && Settings.get('manipulateCookies');

		const messageOptions = {
			action: 'fetch',
			blob: options.blob,
			fileName: options.fileName,
			loggedOut: options.loggedOut,
			manipulateCookies,
			parameters: JSON.stringify(FetchRequest.getFetchOptions(options, manipulateCookies)),
			timeout: options.timeout,
			url,
		};
		let response = await browser.runtime.sendMessage(messageOptions);
		if (typeof response === 'string') {
			response = JSON.parse(response);
		}

		if (Utils.isSet(response.error)) {
			throw new Error(response.error);
		}

		if (response.cfBlocked) {
			throw Object.assign(new Error('CF_BLOCKED'), { cfBlocked: true, url });
		}

		return {
			status: response.status,
			url: response.url,
			redirected: response.redirected,
			text: response.text,
		};
	}

	static async getFetchObj(options: FetchOptions) {
		let fetchObj = null;
		let fetchOptions = FetchRequest.getFetchOptions(options);
		let abortController = null;

		const { isFirefox: isFirefoxEnv } = await FetchRequest.getEnv();
		if (
			isFirefoxEnv &&
			'wrappedJSObject' in window &&
			window.wrappedJSObject
		) {
			fetchObj = XPCNativeWrapper(window.wrappedJSObject.fetch);
			window.wrappedJSObject.fetchOptions = cloneInto(fetchOptions, window);
			fetchOptions = XPCNativeWrapper(window.wrappedJSObject.fetchOptions);
			abortController = new (XPCNativeWrapper(window.wrappedJSObject.AbortController))();
		} else {
			fetchObj = window.fetch;
			abortController = new AbortController();
		}

		return { fetchObj, fetchOptions, abortController };
	}

	static getFetchOptions(options: FetchOptions, manipulateCookies = false): RequestInit {
		return {
			body: options.data,
			credentials: options.anon || manipulateCookies ? 'omit' : 'include',
			headers: options.headers,
			method: options.method,
			redirect: 'follow',
		};
	}

	static addPathParams(url: string, params: Record<string, string> = {}) {
		if (!Object.keys(params).length) {
			return url;
		}

		for (const key in params) {
			url = url.replace(new RegExp(`%${key}%`), encodeURIComponent(params[key]));
		}
		return url;
	}

	static addQueryParams(url: string, params: Record<string, string> = {}) {
		if (!Object.keys(params).length) {
			return url;
		}

		const queryParams = [];
		for (const key in params) {
			queryParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`);
		}
		return `${url}?${queryParams.join('&')}`;
	}
}
