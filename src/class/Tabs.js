class _Tabs {
	open(url) {
		return chrome.runtime.sendMessage({
			action: 'open_tab',
			url,
		});
	}
}

export const Tabs = new _Tabs();
