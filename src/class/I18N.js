import { Utils } from '../lib/jsUtils';

class I18N {
	getMessage(messageName, substitutions) {
		if (Utils.is(substitutions, 'number')) {
			if (substitutions === 1) {
				messageName += '_one';
			} else {
				messageName += '_other';
			}
		}
		return chrome.i18n.getMessage(messageName, substitutions);
	}
}

const i18n = new I18N();

export { i18n };
