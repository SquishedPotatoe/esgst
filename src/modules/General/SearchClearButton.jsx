import { Module } from '../../class/Module';
import { DOM } from '../../class/DOM';
import { Settings } from '../../class/Settings';

class GeneralSearchClearButton extends Module {
	constructor() {
		super();
		this.agsKeys = [
			'ags_type',
			'ags_maxDate',
			'ags_minDate',
			'ags_maxScore',
			'ags_minScore',
			'ags_maxLevel',
			'ags_minLevel',
			'ags_maxEntries',
			'ags_minEntries',
			'ags_maxCopies',
			'ags_minCopies',
			'ags_maxPoints',
			'ags_minPoints',
			'ags_regionRestricted',
			'ags_dlc',
			'ags_app',
			'ags_sub',
		];

		this.info = {
			description: () => (
				<ul>
					<li>Adds a clear button to each search input in the page.</li>
				</ul>
			),
			id: 'scb',
			name: 'Search Clear Button',
			sg: true,
			type: 'general',
		};
	}

	init() {
		this.getInputs(document);
	}

	clearQgs(input, container) {
		input.value = '';
		input.dispatchEvent(new Event('change'));

		for (const key of this.agsKeys) {
			Settings.set(key, key === 'ags_regionRestricted' || key === 'ags_dlc' ? false : '');
		}

		const panel = document.querySelector('.esgst-ags-panel.esgst-popout:not(.esgst-hidden)');
		if (panel) {
			for (const field of panel.querySelectorAll('input, select')) {
				if (field.type === 'checkbox') {
					field.checked = false;
					field.dispatchEvent(new Event('change'));
				} else {
					field.value = '';
					field.dispatchEvent(new Event(field.tagName === 'SELECT' ? 'change' : 'input'));
				}
			}
		}
		input.focus();
	}

	getInputs(context) {
		const inputs = context.querySelectorAll('.sidebar__search-input');
		for (const input of inputs) {
			input.parentElement.classList.add('esgst-scb');
			DOM.insert(
				input.parentElement,
				'beforeend',
				<i
					className="fa fa-times"
					title="Clear search"
					onclick={() => {
						input.value = '';
						input.dispatchEvent(new Event('change'));
						input.focus();
					}}
				></i>
			);
		}

		if (Settings.get('qgs')) {
			const qgsContainers = context.querySelectorAll('.esgst-qgs-container');
			for (const container of qgsContainers) {
				const input = container.querySelector('.esgst-qgs-input');
				if (!input) continue;
				container.classList.add('esgst-scb', 'esgst-scb-qgs');
				DOM.insert(
					container,
					'beforeend',
					<i
						className="fa fa-times"
						title="Clear search"
						onclick={() => {
							this.clearQgs(input, container);
						}}
					></i>
				);
			}
		}
	}
}

const generalSearchClearButton = new GeneralSearchClearButton();

export { generalSearchClearButton };
