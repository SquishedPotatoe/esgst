export interface Permission {
	isOrigin?: boolean;
	messages: Record<string, string>;
	values: string[];
}

class Permissions {
	permissions: Record<string, Permission>;

	constructor() {
		this.permissions = {
			allUrls: {
				isOrigin: true,
				messages: {
					ge: 'Required by Giveaway Extractor to extract giveaways from any URL.',
				},
				values: ['<all_urls>'],
			},
			cookies: {
				messages: {
					manipulateCookies: 'Required if the option to manipulate cookies is enabled.',
				},
				values: ['cookies'],
			},
			dropbox: {
				isOrigin: true,
				messages: {
					storage: 'Required to back up / restore data to / from Dropbox.',
				},
				values: ['*://*.api.dropboxapi.com/*', '*://*.content.dropboxapi.com/*'],
			},
			github: {
				isOrigin: true,
				messages: {
					showChangelog: 'Required to retrieve the changelog from GitHub when updating.',
				},
				values: ['*://*.github.com/*', '*://*.raw.githubusercontent.com/*'],
			},
			googleDrive: {
				isOrigin: true,
				messages: {
					storage: 'Required to back up / restore data to / from Google Drive.',
				},
				values: ['*://*.googleapis.com/*'],
			},
			googleWebApp: {
				isOrigin: true,
				messages: {
					sync: 'Required to sync HLTB times.',
				},
				values: ['*://*.script.google.com/*', '*://*.script.googleusercontent.com/*'],
			},
			imgur: {
				isOrigin: true,
				messages: {
					cfh: 'Required by Comment Formatting Helper to upload images.',
				},
				values: ['*://*.api.imgur.com/*'],
			},
			isThereAnyDeal: {
				isOrigin: true,
				messages: {
					itadi: 'Required by IsThereAnyDeal Info to retrieve the deals.',
				},
				values: ['*://*.isthereanydeal.com/*'],
			},
			Notification: {
				messages: {
					hr: 'Required by Header Refresher to show a notification when points reach a specified threshold.',
					hr_m_n: 'Show the number of unread messages as a notification.',
					tds_n: 'Required by Thread Subscription to show a notification when there are new comments.',
				},
				values: ['notifications'],
			},
			oneDrive: {
				isOrigin: true,
				messages: {
					storage: 'Required to back up / restore data to / from OneDrive.',
				},
				values: ['*://*.files.1drv.com/*', '*://*.graph.microsoft.com/*'],
			},
			sgTools: {
				isOrigin: true,
				messages: {
					ge: 'Required by Giveaway Extractor to extract SGTools giveaways.',
					namwc: 'Required by Not Activated / Multiple Wins Checker to check users.',
					ugs:
						'Required by Unsent Gifts Sender if the option to check not activated / multiple wins is enabled.',
				},
				values: ['*://*.sgtools.info/*'],
			},
			server: {
				isOrigin: true,
				messages: {
					gc:
						'Required by Game Categories to retrieve categories that need to be retrieved from Steam.',
					uh:
						"Required by Username History to retrieve the user's username history and the list of recent changes from the database.",
					ncv: 'Required to update the no CV games database when creating a new giveaway.',
					sync:
						'Required to sync reduced CV and no CV games and optional to hide games when syncing.',
					hgm:
						'Optional for Hidden Game Manager to hide games, by converting Steam app IDs to SteamGifts game IDs.',
					mm: 'Optional for Multi Manager to hide games.',
				},
				values: ['*://*.esgst.rafaelgomes.xyz/*'],
			},
			steamApi: {
				isOrigin: true,
				messages: {
					glwc:
						"Required by Group Libraries / Wishlists Checker to retrieve the users' owned games.",
					hwlc: "Required by Have / Want List Checker to retrieve the user's owned games.",
					sync: 'Required to sync owned / wishlisted / ignored games.',
					ugd:
						"Required by User Giveaway Data to retrieve the user's playtimes / achievement stats.",
				},
				values: ['*://*.api.steampowered.com/*'],
			},
			steamCommunity: {
				isOrigin: true,
				messages: {
					as:
						'Required by Archive Searcher to retrieve the title of a game when searching by app id.',
					glwc: "Required by Group Libraries / Wishlists Checker to retrieve the group's members.",
					gs: "Required by Groups Stats to retrieve the group's type.",
					sgc: "Required by Shared Groups Checker to retrieve the user's groups.",
					sync: 'Required to sync followed games.',
					ugs: 'Required by Unsent Gifts Sender if the option to check group members is enabled.',
				},
				values: ['*://*.steamcommunity.com/*'],
			},
			steamStore: {
				isOrigin: true,
				messages: {
					gc:
						'Required by Game Categories to retrieve categories that need to be retrieved from Steam.',
					glwc: "Required by Group Libraries / Wishlists Checker to retrieve the users' wishlists.",
					hwlc: "Required by Have / Want List Checker to retrieve the user's wishlist.",
					rcvc: "Required by Real CV Calculator to retrieve the game's price.",
					sync: 'Required to sync owned / wishlisted / ignored games.',
					ugd: 'Required by User Giveaway Data to get list of games in packages.',
				},
				values: ['*://*.store.steampowered.com/*'],
			},
			steamTracker: {
				isOrigin: true,
				messages: {
					sync: 'Required to sync delisted games.',
				},
				values: ['*://*.steam-tracker.com/*'],
			},
		};
	}

	async contains(keyArrays: string[][]): Promise<boolean> {
		if (!chrome.runtime?.sendMessage) return false;
		let result = false;

		for (const keys of keyArrays) {
			const { permissions, origins } = this.getValues(keys);
			const response = await chrome.runtime.sendMessage({
				action: 'permissions_contains',
				permissions: { permissions, origins },
			});
			if (response?.success && response.result) {
				result = true;
				break;
			}
		}

		return result;
	}

	async request(keys: string[]): Promise<boolean> {
		const { permissions, origins } = this.getValues(keys);
		const response = await chrome.runtime.sendMessage({
			action: 'permissions_request',
			permissions: { permissions, origins },
		});

		return response?.success && response.result;
	}

	async remove(keys, callback) {
		const { permissions, origins } = this.getValues(keys);

		console.log('[Permissions] removing', { permissions, origins });

		const response = await chrome.runtime.sendMessage({
			action: 'permissions_remove',
			permissions: { permissions, origins },
		});

		const removed = response?.success ? response.result : false;

		if (callback) callback(removed);
		return removed;
	}

	getValues(keys) {
		const permissions: string[] = [];
		const origins: string[] = [];

		for (const key of keys) {
			const entry = this.permissions[key];
			if (!entry) {
				if (key.startsWith("http://") || key.startsWith("https://") || key.startsWith("*://")) {
					origins.push(key);
				} else {
					permissions.push(key);
				}
				continue;
			}

			for (const val of entry.values) {
				if (entry.isOrigin) {
					origins.push(val);
				} else {
					permissions.push(val);
				}
			}
		}

		return { permissions, origins };
	}

	getMessage(keyArrays, isOptional) {
		const combos = [];

		for (const keys of keyArrays) {
			const { permissions, origins } = this.getValues(keys);
			combos.push(permissions.concat(origins).join(' + '));
		}

		return isOptional
			? `If you want to perform this action faster, please go to the "Permissions" section of the settings menu and grant permissions for one (or all) of the combos: ${combos.join(
					' OR '
			  )}`
			: `No permission to perform this action. Please go to the "Permissions" section of the settings menu and grant permissions for one (or all) of the combos: ${combos.join(
					' OR '
			  )}`;
	}
}

export const permissions = new Permissions();
