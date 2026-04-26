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

	static rateLimitUntil = 0;
	static rateLimitPromise: Promise<void> | null = null;
	static cooldownTimerId: number | null = null;
	static get queueKey(): "sg" | "st" {
		return Shared.esgst.sg ? "sg" : "st";
	}

	static async waitForCooldown() {
		const now = Date.now();

		if (now >= this.rateLimitUntil) return;

		if (this.rateLimitPromise) {
			await this.rateLimitPromise;
			return;
		}

		const waitTime = Math.max(0, this.rateLimitUntil - now);

		if (this.cooldownTimerId) {
			clearTimeout(this.cooldownTimerId);
			this.cooldownTimerId = null;
		}

		this.rateLimitPromise = new Promise<void>(resolve => {
			this.cooldownTimerId = window.setTimeout(() => {
				this.rateLimitPromise = null;
				this.cooldownTimerId = null;
				resolve();
			}, waitTime);
		});

		await this.rateLimitPromise;
	}

	static async send(url: string, options: FetchOptions): Promise<FetchResponse> {
		let response = null;
		let lock = null;
		if (typeof url === 'object' && url.path) {
			url = url.path;
		} else if (typeof url !== 'string') {
			url = String(url);
		}

		url = url
			.replace(/^\//, `https://${window.location.hostname}/`)
			.replace(/^https?:/, Shared.esgst.locationHref.match(/^http:/) ? 'http:' : 'https:');
		if (url.match(/steamgifts\.com\/group\/[^/]+$/)) {
			url += '/';
		}
		if (options.pathParams) {
			url = FetchRequest.addPathParams(url, options.pathParams);
		}
		if (options.queryParams) {
			url = FetchRequest.addQueryParams(url, options.queryParams);
		}
		options.headers = {
			...FetchRequest.DEFAULT_HEADERS,
			...options.headers,
		};

		try {
			const isInternal = url.match(new RegExp(window.location.hostname));
			if (options.queue) {
				lock = new Lock('request', {
					threshold: typeof options.queue === 'number' ? options.queue : 1000,
				});
				chrome.runtime.sendMessage({
					action: 'record_request',
					key: FetchRequest.queueKey
				});
			} else if (isInternal && !options.doNotQueue) {
				const res = await chrome.runtime.sendMessage({
					action: 'queue_request',
					key: FetchRequest.queueKey,
				});
				if (!res?.success) {
					throw new Error(`queue_request failed: ${res?.error || 'unknown error'}`);
				}
			} else {
				if (isInternal && options.doNotQueue) {
					chrome.runtime.sendMessage({ action: 'record_request', key: FetchRequest.queueKey });
				}
				if (url.match(/^https?:\/\/store.steampowered.com/) && Settings.get('limitSteamStore')) {
					lock = new Lock('steamStore', { threshold: 200 });
				}
			}

			if (lock) {
				await lock.lock();
			}

			if (isInternal) {
				response = await FetchRequest.sendInternal(url, options);
			} else {
				response = await FetchRequest.sendExternal(url, options);
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
		}
	}

	static async sendInternal(url: string, options: FetchOptions): Promise<FetchResponse> {
		await this.waitForCooldown();

		const { fetchObj, fetchOptions } = await this.getFetchObj(options);
		const globalTimeout = 2 * 60_000;
		const startTime = Date.now();

		for (; ;) {
			if (Date.now() - startTime > globalTimeout) {
				throw new Error('Fetch retry timeout reached (exceeded 2 minutes)');
			}

			const abortController = new AbortController();
			fetchOptions.signal = abortController.signal;

			const timeout = options.timeout ?? 10000;
			const timeoutId = window.setTimeout(() => abortController.abort(), timeout);

			let response: Response;
			try {
				response = await fetchObj(url, fetchOptions);
			} finally {
				window.clearTimeout(timeoutId);
			}

			const text = await response.text();

			if (response.status === 429) {
				const now = Date.now();
				let cooldown = 0;
				const retryAfter = response.headers.get("Retry-After");

				if (retryAfter) {
					const seconds = Number(retryAfter);
					if (!Number.isNaN(seconds)) cooldown = seconds * 1000;
					else {
						const retryDate = new Date(retryAfter).getTime();
						if (!Number.isNaN(retryDate)) cooldown = Math.max(0, retryDate - now);
					}
				}
				if (!cooldown) cooldown = this.queueKey === "sg" ? 60_000 : 15_000;
				cooldown += 5000;

				if (this.rateLimitUntil < now) {
					this.rateLimitUntil = now + cooldown;

					await chrome.runtime.sendMessage({
						action: "rate_limit_hit",
						key: this.queueKey,
						cooldown
					});

					window.dispatchEvent(
						new CustomEvent("rate_limit_hit", { detail: { cooldown } })
					);
				}
				await this.waitForCooldown();
				continue;
			}
			if (response.redirected) {
				await chrome.runtime.sendMessage({
					action: 'record_request',
					key: FetchRequest.queueKey,
				});
			}
			if (!response.ok) throw new Error(text);

			return {
				status: response.status,
				url: response.url,
				redirected: response.redirected,
				text,
			};
		}
	}

	static async sendExternal(url: string, options: FetchOptions): Promise<FetchResponse> {
		const manipulateCookies = Settings.get('manipulateCookies');

		const messageOptions = {
			action: 'fetch',
			blob: options.blob,
			fileName: options.fileName,
			manipulateCookies,
			parameters: FetchRequest.getFetchOptions(options, manipulateCookies),
			timeout: options.timeout,
			url,
		};
		const response = await chrome.runtime.sendMessage(messageOptions);

		if (response.error != null) {
			throw new Error(response.error);
		}

		return {
			status: response.status,
			url: response.url,
			redirected: response.redirected,
			text: response.text,
		};
	}

	static async getFetchObj(options: FetchOptions) {
		return {
			fetchObj: window.fetch,
			fetchOptions: FetchRequest.getFetchOptions(options),
			abortController: new AbortController()
		};
	}

	static getFetchOptions(options: FetchOptions, manipulateCookies = false): RequestInit {
		return {
			body: options.data,
			credentials: options.anon ? 'omit' : 'include',
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
