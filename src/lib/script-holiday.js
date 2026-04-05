(() => {
	const BOX_OBSERVER_KEY = '__holidayBoxesObserverAttached';
	let holidayBoxes = null;
	let bodyObserver = null;

	const attachObserver = () => {
		const boxList = document.querySelector(".giveaway_box_list");
		if (!boxList || boxList[BOX_OBSERVER_KEY]) return;
		holidayBoxes = new MutationObserver(() => {
			giveaway_box_redraw();
		});
		holidayBoxes.observe(boxList, { childList: true });
		boxList[BOX_OBSERVER_KEY] = true;
	};

	attachObserver();

	bodyObserver = new MutationObserver(() => {
		attachObserver();
	});

	bodyObserver.observe(document.body, { childList: true, subtree: true });
	const cleanup = () => {
		if (holidayBoxes) {
			holidayBoxes.disconnect();
			holidayBoxes = null;
		}
		if (bodyObserver) {
			bodyObserver.disconnect();
			bodyObserver = null;
		}
	};

	window.addEventListener('beforeunload', cleanup);
	window.addEventListener('unload', cleanup);
})();
