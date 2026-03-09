import { Shared } from './Shared';
import { DOM } from './DOM';

class Button {
	constructor(context, position, details) {
		this.callbacks = details.callbacks;
		this.states = this.callbacks.length;
		this.icons = details.icons;
		this.id = details.id;
		this.index = details.index;
		this.titles = details.titles;
		DOM.insert(
			context,
			position,
			<div className={details.className} ref={(ref) => (this.button = ref)}></div>
		);
		// noinspection JSIgnoredPromiseFromCall
		this.change();
		return this;
	}

	async change(mainCallback, index = this.index, event) {
		if (index >= this.states) {
			index = 0;
		}
		this.index = index + 1;
		this.button.title = Shared.common.getFeatureTooltip(this.id, this.titles[index]);
		const icon = this.icons[index];
		const prefix = /^(fas|far|fal|fab)\b/.test(icon) ? '' : 'fa ';

		DOM.insert(this.button, 'atinner', <i className={`${prefix}${icon}`}></i>);
		if (mainCallback) {
			if (await mainCallback(event)) {
				// noinspection JSIgnoredPromiseFromCall
				this.change();
			} else {
				DOM.insert(
					this.button,
					'atinner',
					<i className="fa fa-times esgst-red" title="Unable to perform action"></i>
				);
			}
		} else if (this.callbacks[index]) {
			this.button.addEventListener(
				'click',
				this.change.bind(this, this.callbacks[index], undefined)
			);
		}
	}

	async triggerCallback() {
		await this.change(this.callbacks[this.index - 1]);
	}
}

export { Button };
