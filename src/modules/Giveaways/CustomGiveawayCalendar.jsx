import { Module } from '../../class/Module';
import { Settings } from '../../class/Settings';
import { DOM } from '../../class/DOM';

class GiveawaysCustomGiveawayCalendar extends Module {
	constructor() {
		super();
		this.info = {
			description: () => (
				<ul>
					<li>
						Allows you to customize the calendar for selecting the start/end times of giveaways in
						the <a href="https://www.steamgifts.com/giveaways/new">new giveaway</a> page.
					</li>
					<li>
						Make sure to test if SteamGifts accepts the format you entered by reviewing a test
						giveaway.
					</li>
				</ul>
			),
			inputItems: [
				{
					id: 'cgc_dateFormat',
					prefix: `Date format: `,
					suffix: ` (check accepted formats here: http://api.jqueryui.com/datepicker/#utility-formatDate)`,
				},
				{
					id: 'cgc_timeFormat',
					prefix: `Time format: `,
					suffix: ` (check accepted formats here: https://trentrichardson.com/examples/timepicker/#tp-formatting)`,
				},
			],
			options: [
				{
					title: `First day of the week: `,
					values: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
				},
			],
			id: 'cgc',
			name: 'Custom Giveaway Calendar',
			sg: true,
			type: 'giveaways',
		};
	}

	init() {
		if (!this.esgst.newGiveawayPath || !document.getElementsByClassName('form__rows')[0]) {
			return;
		}
		(async () => {
			const items = {
				cgc_dateFormat: await Settings.get('cgc_dateFormat'),
				cgc_index_0: await Settings.get('cgc_index_0'),
				cgc_timeFormat: await Settings.get('cgc_timeFormat')
			};

			const script = document.createElement('script');
			script.src = chrome.runtime.getURL('lib/script-custom-giveaway-calendar.js');
			script.dataset.settings = JSON.stringify(items); // pass via attribute
			document.documentElement.appendChild(script);
			script.remove();
		})();
	}
}

const giveawaysCustomGiveawayCalendar = new GiveawaysCustomGiveawayCalendar();

export { giveawaysCustomGiveawayCalendar };
