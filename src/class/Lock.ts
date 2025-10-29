type LockData = {
	uuid: string;
	key: string;
} & LockOptions;

interface LockOptions {
	threshold: number;
	timeout: number;
	tryOnce: boolean;
}

export class Lock {
	private data: LockData;
	private locked = false;

	constructor(key: string, data: Partial<LockOptions> = {}) {
		this.data = {
			uuid: crypto.randomUUID(),
			key: `${key}Lock`,
			threshold: 100,
			timeout: 15000,
			tryOnce: false,
			...data,
		};
	}

	get isLocked(): boolean {
		return this.locked;
	}

	lock = async (): Promise<void> => {
		try {
			const response = await chrome.runtime.sendMessage({
				action: 'do_lock',
				lock: this.data,
			});

			this.locked = !!(response && response.locked);
		} catch (err) {
			console.error('Lock error:', err);
			this.locked = false;
		}
	};

	update = async (): Promise<void> => {
		try {
			await chrome.runtime.sendMessage({
				action: 'update_lock',
				lock: this.data,
			});
		} catch (err) {
			console.error('Lock update error:', err);
		}
	};

	unlock = async (): Promise<void> => {
		try {
			await chrome.runtime.sendMessage({
				action: 'do_unlock',
				lock: this.data,
			});
			this.locked = false;
		} catch (err) {
			console.error('Unlock error:', err);
		}
	};
}
