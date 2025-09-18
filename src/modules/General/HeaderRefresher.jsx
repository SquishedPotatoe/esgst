import { Module } from '../../class/Module';
import { common } from '../Common';
import { Settings } from '../../class/Settings';
import { Logger } from '../../class/Logger';
import { EventDispatcher } from '../../class/EventDispatcher';
import { Events } from '../../constants/Events';
import { FetchRequest } from '../../class/FetchRequest';
import { Namespaces } from '../../constants/Namespaces';
import { Session } from '../../class/Session';
import { Shared } from '../../class/Shared';
import { Header } from '../../components/Header';
import { LocalStorage } from '../../class/LocalStorage';
import { Tabs } from '../../class/Tabs';
import { DOM } from '../../class/DOM';

class GeneralHeaderRefresher extends Module {
	constructor() {
		super();
		this.info = {
			description: () => (
				<ul>
					<li>
						Refreshes the header icons (created/won/inbox for SteamGIFTS and inbox for SteamTrades)
						and the points on SteamGifts (in any page) every specified number of minutes.
					</li>
					<li>
						There are also options to notify you when there are new wishlist giveaways open, when
						the key for a game you won is delivered, when you reach 400P and when you receive a new
						message.
					</li>
					<li>You can upload a custom sound for the browser notifications.</li>
					<li>
						If you enable the options to show browser notifications, you will be asked to give the
						permission to ESGST by your browser.
					</li>
				</ul>
			),
			features: {
				hr_w: {
					features: {
						hr_w_n: {
							features: {
								hr_w_n_s: {
									name: 'Play a sound with this notification.',
									inputItems: true,
									sg: true,
								},
							},
							name: 'Also show as a browser notification.',
							sg: true,
						},
						hr_w_h: {
							name: 'Only indicate for giveaways ending in a specified number of hours.',
							inputItems: [
								{
									id: 'hr_w_hours',
									prefix: `Hours: `,
								},
							],
							sg: true,
						},
					},
					inputItems: [
						{
							id: 'hr_w_format',
							prefix: `Format: `,
							tooltip: `Use # to represent a number. For example, '(#❤)' would show '(8❤)' if there are 8 unentered wishlist giveaways open.`,
						},
					],
					name: "Indicate if there are unentered wishlist giveaways open in the tab's title.",
					sg: true,
				},
				hr_g: {
					features: {
						hr_g_n: {
							features: {
								hr_g_n_s: {
									name: 'Play a sound with this notification.',
									inputItems: true,
									sg: true,
								},
							},
							name: 'Also show as a browser notification.',
							sg: true,
						},
					},
					inputItems: [
						{
							id: 'hr_g_format',
							prefix: `Format: `,
						},
					],
					name: "Indicate if there are unviewed keys for won gifts in the tab's title.",
					sg: true,
				},
				hr_b: {
					name:
						'Keep refreshing in the background when you go to another tab or minimize the browser.',
					sg: true,
					st: true,
				},
				hr_c: {
					description: () => (
						<ul>
							<li>
								With this option disabled, notifications will automatically close after a few
								seconds.
							</li>
						</ul>
					),
					name: 'Only close notifications manually.',
					sg: true,
					st: true,
				},
				hr_fp: {
					features: {
						hr_fp_p: {
							name: 'Minimum number of points required to show a browser notification.',
							inputItems: [
								{
									id: 'hr_fp_points',
									prefix: 'Notify when points reach ',
									attributes: {
										type: 'number',
										min: '1',
										max: '400',
										step: '1',
									},
								},
							],
							sg: true,
						},
						hr_fp_s: {
							name: 'Play a sound with this notification.',
							inputItems: true,
							sg: true,
						},
					},
					name: 'Show a browser notification when points reach a specified threshold.',
					sg: true,
				},
				hr_p: {
					inputItems: [
						{
							id: 'hr_p_format',
							prefix: `Format: `,
							tooltip: `Use # to represent a number. For example, '(#P)' would show '(100P)' if you have 100 points.`,
						},
					],
					name: "Show the number of points in the tab's title.",
					sg: true,
				},
				hr_m: {
					features: {
						hr_m_n: {
							features: {
								hr_m_n_s: {
									name: 'Play a sound with this notification.',
									inputItems: true,
									sg: true,
									st: true,
								},
							},
							name: 'Also show as a browser notification.',
							sg: true,
							st: true,
						},
					},
					name: "Show the number of unread messages in the tab's icon.",
					sg: true,
					st: true,
				},
				hr_a: {
					description: () => (
						<ul>
							<li>
								With this option disabled, clicking on a notification will always open a new tab.
							</li>
						</ul>
					),
					features: {
						hr_a_r: {
							name: 'Refresh the page after setting it as active.',
							sg: true,
							st: true,
						},
						hr_a_a: {
							name: `If the page is not open, set any SteamGifts/SteamTrades tab as active.`,
							sg: true,
							st: true,
						},
					},
					name: `When clicking on a browser notification, check if the related page is open and set it as active.`,
					sg: true,
					st: true,
				},
			},
			inputItems: [
				{
					id: 'hr_minutes',
					prefix: 'Refresh every ',
					suffix: ' minutes',
				},
				{
					id: 'hr_sound_volume',
					prefix: 'Sound volume: ',
					suffix: ' (0–100)',
					attributes: {
						type: 'number',
						min: '0',
						max: '100',
						step: '1',
					},
				},
			],
			id: 'hr',
			name: 'Header Refresher',
			sg: true,
			st: true,
			type: 'general',
		};
	}

	init() {
		EventDispatcher.subscribe(Events.WON_UPDATED, this.notifyWon.bind(this, false));
		EventDispatcher.subscribe(Events.MESSAGES_UPDATED, this.notifyMessages.bind(this, false));
		EventDispatcher.subscribe(Events.POINTS_UPDATED, this.notifyPoints.bind(this, false));
		EventDispatcher.subscribe(Events.WISHLIST_UPDATED, this.notifyWishlist.bind(this, false));

		this.notifyWon(true, Session.counters.won, Session.counters.won);
		this.notifyMessages(true, Session.counters.messages, Session.counters.messages);
		this.notifyPoints(true, Session.counters.points, Session.counters.points);

		this.startRefresher();

		if (!Settings.get('hr_b')) {
			window.addEventListener('focus', this.startRefresher.bind(this));
			window.addEventListener('blur', () => window.clearTimeout(this.refresher));
		}
	}

	async startRefresher() {
		const cacheRaw = LocalStorage.get('hrCache');
		let cache;

		try {
			cache = cacheRaw ? JSON.parse(cacheRaw) : {};
		} catch (e) {
			console.warn('[HR] Failed to parse hrCache, resetting.');
			cache = {};
		}
		const now = Date.now();
		if (!cache.timestamp || cache.timestamp > now) {
			cache.timestamp = now;
		}

		if (cache.username !== Settings.get('username')) {
			cache = { username: Settings.get('username'), timestamp: now };
		}

		LocalStorage.set('hrCache', JSON.stringify(cache));

		const response = await FetchRequest.get(
			Shared.esgst.sg ? '/giveaways/search?type=wishlist' : '/'
		);

		await this.refreshHeader(response.html);

		this.refresher = window.setTimeout(
			() => this.continueRefresher(),
			Settings.get('hr_minutes') * 60000
		);
	}

	async continueRefresher() {
		const cacheRaw = LocalStorage.get('hrCache');
		let cache;

		try {
			cache = cacheRaw ? JSON.parse(cacheRaw) : {};
		} catch (e) {
			console.warn('[HR] Failed to parse hrCache, resetting.');
			cache = {};
		}

		const now = Date.now();
		if (!cache.timestamp || cache.timestamp > now) {
			cache.timestamp = now;
		}

		const interval = Settings.get('hr_minutes') * 60000;

		if (cache.username !== Settings.get('username') || now - cache.timestamp > interval) {
			cache.timestamp = now;
			cache.username = Settings.get('username');
			LocalStorage.set('hrCache', JSON.stringify(cache));

			const response = await FetchRequest.get(
				Shared.esgst.sg ? '/giveaways/search?type=wishlist' : '/'
			);

			await this.refreshHeader(response.html);

		} else {
			await this.refreshHeader(null, cache);

			this.wishlist = cache.wishlist;
			this.newWishlist = cache.newWishlist;
		}
		this.refresher = window.setTimeout(
			() => this.continueRefresher(),
			interval
		);
	}

	/**
	 * @param {Document} context
	 * @param {IHeaderRefresherCache} cache
	 */
	async refreshHeader(context, cache) {
		if (context) {
			/** @type {import('../../components/Header').IHeader} */
			const header = new Header();

			header.parse(context);

			switch (Session.namespace) {
				case Namespaces.SG: {
					const createdContainer = header.buttonContainers['giveawaysCreated'];

					if (createdContainer) {
						await Shared.header.updateCounter('giveawaysCreated', createdContainer.data.counter);
					}

					const wonContainer = header.buttonContainers['giveawaysWon'];

					if (wonContainer) {
						await Shared.header.updateCounter(
							'giveawaysWon',
							wonContainer.data.counter,
							wonContainer.data.isFlashing
						);
					}

					const messagesContainer = header.buttonContainers['messages'];

					if (messagesContainer) {
						await Shared.header.updateCounter('messages', messagesContainer.data.counter);
					}

					const accountContainer = header.buttonContainers['account'];

					if (accountContainer) {
						await Shared.header.updatePoints(accountContainer.data.points);
						await Shared.header.updateLevel(accountContainer.data.level);
					}

					if (Settings.get('hr_w')) {
						this.wishlist = 0;
						this.newWishlist = 0;

						const cache = JSON.parse(LocalStorage.get('hrWishlistCache', '[]'));
						const codes = [];
						const now = Date.now();

						const giveaways = await Shared.esgst.modules.giveaways.giveaways_get(
							context,
							false,
							null,
							true
						);

						for (const giveaway of giveaways) {
							codes.push(giveaway.code);

							if (
								giveaway &&
								giveaway.level <= Session.counters.level.base &&
								!giveaway.pinned &&
								!giveaway.entered &&
								(!Shared.esgst.giveaways[giveaway.code] ||
									(!Shared.esgst.giveaways[giveaway.code].visited &&
										!Shared.esgst.giveaways[giveaway.code].hidden)) &&
								(!Settings.get('hr_w_h') ||
									giveaway.endTime - now < Settings.get('hr_w_hours') * 3600000)
							) {
								this.wishlist += 1;

								if (cache.indexOf(giveaway.code) < 0) {
									this.newWishlist += 1;

									cache.push(giveaway.code);
								}
							}
						}

						for (let i = cache.length - 1; i > -1; i--) {
							if (codes.indexOf(cache[i]) < 0) {
								cache.splice(i, 1);
							}
						}

						LocalStorage.set('hrWishlistCache', JSON.stringify(cache));

						await EventDispatcher.dispatch(
							Events.WISHLIST_UPDATED,
							0,
							this.newWishlist,
							this.wishlist
						);
					}

					break;
				}

				case Namespaces.ST: {
					const messagesContainer = header.buttonContainers['messages'];

					if (messagesContainer) {
						await Shared.header.updateCounter('messages', messagesContainer.data.counter);
					}

					break;
				}

				default: {
					throw 'Invalid namespace.';
				}
			}
		} else if (cache) {
			switch (Session.namespace) {
				case Namespaces.SG: {
					await Shared.header.updateCounter('giveawaysCreated', cache.created);
					await Shared.header.updateCounter('giveawaysWon', cache.won, cache.wonDelivered);
					await Shared.header.updateCounter('messages', cache.messages);

					await Shared.header.updatePoints(cache.points);
					await Shared.header.updateLevel(cache.level);

					await EventDispatcher.dispatch(
						Events.WISHLIST_UPDATED,
						this.newWishlist,
						cache.newWishlist,
						cache.wishlist
					);

					break;
				}

				case Namespaces.ST: {
					await Shared.header.updateCounter('messages', cache.messages);

					break;
				}

				default: {
					throw 'Invalid namespace.';
				}
			}
		}

		await EventDispatcher.dispatch(Events.HEADER_REFRESHED);
	}

	notifyWon(firstRun, oldWon, newWon, delivered) {
		if (delivered && Settings.get('hr_g')) {
			if (Settings.get('hr_g_n') && !firstRun) {
				this.showNotification({
					msg: 'You have new gifts delivered.',
					won: true,
				});
			}

			this.deliveredTitle = Settings.get('hr_g_format');
		} else {
			this.deliveredTitle = null;
		}

		this.notifyTitleChange();
	}

	notifyMessages(firstRun, oldMessages, newMessages) {
		const difference = newMessages - oldMessages;

		if (newMessages > 0 && Settings.get('hr_m')) {
			const canvas = document.createElement('canvas');
			const image = new Image();

			canvas.width = 16;
			canvas.height = 16;

			const context = canvas.getContext('2d');

			image.crossOrigin = 'esgst';

			image.onload = () => {
				context.drawImage(image, 0, 0);
				context.fillStyle = '#e9202a';
				context.fillRect(8, 6, 8, 10);
				context.fillStyle = '#fff';
				context.font = 'bold 10px Arial';
				context.textAlign = 'left';

				context.fillText(newMessages > 9 ? '+' : newMessages, 9, 14);

				Shared.esgst.favicon.href = canvas.toDataURL('image/png');
			};

			image.src = Shared.esgst[`${Shared.esgst.name}Icon`];

			if (difference > 0 && Settings.get('hr_m_n') && !firstRun) {
				this.showNotification({
					inbox: true,
					msg: `You have ${difference} new messages.`,
				});
			}
		} else {
			Shared.esgst.favicon.href = Shared.esgst[`${Shared.esgst.name}Icon`];
		}

		this.notifyTitleChange();
	}

	notifyPoints(firstRun, oldPoints, newPoints) {
		if (oldPoints < 400 && newPoints >= Settings.get('hr_fp_points') && Settings.get('hr_fp') && !firstRun) {
			this.showNotification({
				msg: `You have ${newPoints}P.`,
				points: true,
			});
		}

		this.pointsTitle = Settings.get('hr_p')
			? `${Settings.get('hr_p_format').replace(/#/, newPoints)}`
			: null;

		this.notifyTitleChange();
	}

	notifyWishlist(firstRun, oldWishlist, newWishlist, wishlist) {
		if (newWishlist && Settings.get('hr_w') && Settings.get('hr_w_n') && !firstRun) {
			this.showNotification({
				msg: Settings.get('hr_w_h')
					? `You have ${newWishlist} new wishlist giveaways ending in ${Settings.get(
							'hr_w_hours'
					  )} hours.`
					: `You have ${newWishlist} new wishlist giveaways.`,
				wishlist: true,
			});
		}

		this.wishlistTitle =
			wishlist && Settings.get('hr_w')
				? `${Settings.get('hr_w_format').replace(/#/, wishlist)}`
				: null;

		this.notifyTitleChange();
	}

	notifyTitleChange() {
		const titleParts = [];

		if (this.pointsTitle) {
			titleParts.push(this.pointsTitle);
		}

		if (this.deliveredTitle) {
			titleParts.push(this.deliveredTitle);
		}

		if (this.wishlistTitle) {
			titleParts.push(this.wishlistTitle);
		}

		titleParts.push(Shared.esgst.originalTitle);

		const title = titleParts.join(' ');

		if (document.title !== title) {
			document.title = title;
		}

		this.updateCache();
	}

	updateCache() {
		LocalStorage.set(
			'hrCache',
			JSON.stringify({
				created: Session.counters.created,
				level: Session.counters.level,
				messages: Session.counters.messages,
				newWishlist: this.newWishlist,
				points: Session.counters.points,
				timestamp: Date.now(),
				username: Session.user.username,
				wishlist: this.wishlist,
				won: Session.counters.won,
				wonDelivered: Session.counters.wonDelivered,
			})
		);
	}

	async showNotification(details) {
		const result = await window.Notification.requestPermission();

		if (result !== 'granted') {
			return;
		}

		if (
			(details.won && Settings.get('hr_g_n_s')) ||
			(details.inbox && Settings.get('hr_m_n_s')) ||
			(details.points && Settings.get('hr_fp_s')) ||
			(details.wishlist && Settings.get('hr_w_n_s'))
		) {
			try {
				if (!this.audioContext) {
					this.audioContext = new AudioContext();

					this.wonPlayer = await this.createPlayer(
						Settings.get('hr_g_n_s_sound') || this.getDefaultSound()
					);
					this.messagesPlayer = await this.createPlayer(
						Settings.get('hr_m_n_s_sound') || this.getDefaultSound()
					);
					this.pointsPlayer = await this.createPlayer(
						Settings.get('hr_fp_s_sound') || this.getDefaultSound()
					);
					this.wishlistPlayer = await this.createPlayer(
						Settings.get('hr_w_n_s_sound') || this.getDefaultSound()
					);
				}

				if (details.won && this.wonPlayer) {
					this.wonPlayer.play();
				}

				if (details.inbox && this.messagesPlayer) {
					this.messagesPlayer.play();
				}

				if (details.points && this.pointsPlayer) {
					this.pointsPlayer.play();
				}

				if (details.wishlist && this.wishlistPlayer) {
					this.wishlistPlayer.play();
				}
			} catch (error) {
				Logger.warning(error.message);
			}
		}

		const notification = new Notification('ESGST Notification', {
			body: details.msg,
			icon: chrome.runtime.getURL("icon.png"),
			requireInteraction: !!Settings.get('hr_c'),
			tag: details.msg,
		});

		notification.onclick = () => {
			if (Settings.get('hr_a')) {
				chrome.runtime.sendMessage({
					action: 'tabs',
					any: !!Settings.get('hr_a_a'),
					inbox_sg: Shared.esgst.sg && !!details.inbox,
					inbox_st: Shared.esgst.st && !!details.inbox,
					refresh: !!Settings.get('hr_a_r'),
					wishlist: !!details.wishlist,
					won: !!details.won,
				}, (resp) => {
					if (chrome.runtime.lastError) console.warn('sendMessage error', chrome.runtime.lastError);
					else console.log('tabs message response', resp);
				});
			} else {
				if (details.won) {
					Tabs.open('https://www.steamgifts.com/giveaways/won');
				}

				if (details.inbox) {
					Tabs.open('https://www.steamgifts.com/messages');
				}

				if (details.wishlist) {
					Tabs.open('https://www.steamgifts.com/giveaways/search?type=wishlist');
				}
			}

			notification.close();
		};
	}

	async createPlayer(string) {
		const volRaw = Settings.get('hr_sound_volume');
		const userVolume = volRaw === null || volRaw === undefined ? 0.15 : Number(volRaw) / 100;

		if (!string || string === this.getDefaultSound()) {
			if (!this.audioContext) {
				try {
					this.audioContext = new AudioContext();
				} catch (error) {
					return null;
				}
			}
			return {
				play: () => this.windowsNotifyFinal(userVolume),
			};
		}

		const binary = window.atob(string);
		const buffer = new ArrayBuffer(binary.length);
		const bytes = new Uint8Array(buffer);

		for (let i = buffer.byteLength - 1; i > -1; i--) {
			bytes[i] = binary.charCodeAt(i) & 0xff;
		}

		if (!this.audioContext) {
			try {
				this.audioContext = new AudioContext();
			} catch (error) {
				return null;
			}
		}

		const decoded = await this.audioContext.decodeAudioData(buffer);
		return {
			play: () => this.playSound(decoded, userVolume),
		};
	}

	playSound(buffer, volume = 0.15) {
		const source = this.audioContext.createBufferSource();
		const gain = this.audioContext.createGain();
		gain.gain.value = volume;

		source.buffer = buffer;
		source.loop = false;
		source.connect(gain);
		gain.connect(this.audioContext.destination);

		source.start(0);
	}

	getDefaultSound() {
		return '__DEFAULT__ALERT_SOUND__';
	}

	windowsNotifyFinal(volume = 0.15) {
		const ctx = this.audioContext || new AudioContext();
		this.audioContext = ctx;

		const notes = [
			{ freq: 600, duration: 300, glide: 4 },
			{ freq: 520, duration: 350, glide: -2 },
		];

		let currentTime = ctx.currentTime;

		notes.forEach(({ freq, duration, glide }) => {
			const masterGain = ctx.createGain();
			masterGain.connect(ctx.destination);

			const filter = ctx.createBiquadFilter();

			filter.type = 'lowpass';
			filter.frequency.setValueAtTime(1800, currentTime);
			filter.Q.setValueAtTime(0.7, currentTime);
			filter.connect(masterGain);

			const numHarmonics = 15;

			for (let i = 1; i <= numHarmonics; i++) {
				const osc = ctx.createOscillator();
				const g = ctx.createGain();
				osc.type = 'sine';

				const inharmonic = i > 1 ? 1 + (Math.random() - 0.5) * 0.002 : 1;

				osc.frequency.setValueAtTime(freq * i * inharmonic, currentTime);
				osc.frequency.linearRampToValueAtTime((freq + glide) * i * inharmonic, currentTime + duration / 1000);

				const harmonicVolume = volume * Math.pow(0.55, i - 1);
				const attackTime = 0.02 + i * 0.002;

				g.gain.setValueAtTime(0.001, currentTime);
				g.gain.exponentialRampToValueAtTime(harmonicVolume, currentTime + attackTime);

				const decayTime = duration / 1000 * (0.7 + i / (numHarmonics * 0.6));

				g.gain.exponentialRampToValueAtTime(0.001, currentTime + decayTime);
				osc.connect(g);
				g.connect(filter);
				osc.start(currentTime);
				osc.stop(currentTime + decayTime + 0.05);
			}

			currentTime += duration / 1000 + 0.05;
		});
	}
}

const generalHeaderRefresher = new GeneralHeaderRefresher();

export { generalHeaderRefresher };
