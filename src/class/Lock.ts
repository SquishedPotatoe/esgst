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
		const response = await chrome.runtime.sendMessage({
			action: 'do_lock',
			lock: this.data,
		});

		if (response && typeof response.locked === 'boolean') {
			this.locked = response.locked;
		} else {
			this.locked = false;
		}
	};

	update = (): Promise<void> => {
		return chrome.runtime.sendMessage({
			action: 'update_lock',
			lock: this.data,
		});
	};

	unlock = (): Promise<void> => {
		return chrome.runtime.sendMessage({
			action: 'do_unlock',
			lock: this.data,
		});
	};
}
