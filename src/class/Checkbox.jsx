import { Shared } from './Shared';
import { DOM } from './DOM';

class Checkbox {
	constructor(context, defaultValue, threeState, messages = {}) {
		this.onPreEnabled = null;
		this.onPreDisabled = null;
		this.onEnabled = null;
		this.onDisabled = null;
		this.onChange = null;
		this.isBlocked = false;
		this.value = defaultValue;
		this.isThreeState = threeState;
		DOM.insert(
			context || DOM.fragment(),
			'afterbegin',
			<span className="esgst-checkbox" ref={(ref) => (this.checkbox = ref)}>
				<input className="esgst-hidden" type="checkbox" />
				<i className="fa esgst-checkbox-icon"></i>
			</span>
		);
		this.input = this.checkbox.querySelector('input');
		if (this.isThreeState) {
			if (!this.value) this.value = 'disabled';
			this.setIcon(this.value);
			this.checkbox.addEventListener('click', (event) =>
				this.change(false, null, null, event)
			);
		} else {
			this.input.checked = !!this.value;
			this.value = this.input.checked ? 'enabled' : 'disabled';
			this.setIcon(this.value);
			this.checkbox.addEventListener('click', (event) =>
				this.change(true, null, null, event)
			);
		}
	}

	getIcon() {
		return this.checkbox.querySelector('.esgst-checkbox-icon');
	}

	setIcon(state) {
		const icon = this.getIcon();
		if (!icon) return;
		icon.classList.remove(
			'fa-square-o',
			'fa-square',
			'fa-check-square'
		);
		if (state === 'disabled') {
			icon.classList.add('fa-square-o');
		} else if (state === 'none') {
			icon.classList.add('fa-square');
		} else {
			icon.classList.add('fa-check-square');
		}
	}

	change(toggle, value, callback, event) {
		if (event) event.stopPropagation();
		if (this.isThreeState) {
			if ((this.value === 'disabled' && !value) || value === 'none') {
				this.value = 'none';

			} else if ((this.value === 'none' && !value) || value === 'enabled') {

				this.value = 'enabled';
			} else {
				this.value = 'disabled';
			}
			this.setIcon(this.value);
		} else {
			if (toggle) {
				this.preValue = this.input.checked = !this.input.checked;
			} else {
				this.preValue = this.input.checked;
			}
			if (this.preValue) {
				if (this.onPreEnabled && !this.isBlocked) {
					this.onPreEnabled(event);
				}
				this.value = 'enabled';
				this.setIcon('enabled');
				if (this.onEnabled && !this.isBlocked) {
					this.onEnabled(event);
				}
			} else {
				if (this.onPreDisabled && !this.isBlocked) {
					this.onPreDisabled(event);
				}
				this.value = 'disabled';
				this.setIcon('disabled');
				if (this.onDisabled && !this.isBlocked) {
					this.onDisabled(event);
				}
			}
		}
		if (event && this.onChange) {
			this.onChange();
		}
	}

	check(callback) {
		this.preValue = this.input.checked = true;
		this.value = 'enabled';
		this.setIcon('enabled');
		if (this.onChange) {
			this.onChange();
		}
	}

	uncheck(callback) {
		this.preValue = this.input.checked = false;
		this.value = 'disabled';
		this.setIcon('disabled');
		if (this.onChange) {
			this.onChange();
		}
	}

	toggle(callback) {
		this.change(true, null, callback);
		if (this.onChange) {
			this.onChange();
		}
	}
}

export { Checkbox };
