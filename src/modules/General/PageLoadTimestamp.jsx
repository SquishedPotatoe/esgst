import { Module } from '../../class/Module';
import { format } from '../../lib/date';
import { Settings } from '../../class/Settings';
import { DOM } from '../../class/DOM';
import { Shared } from '../../class/Shared';

class GeneralPageLoadTimestamp extends Module {
	constructor() {
		super();
		this.info = {
			description: () => (
				<ul>
					<li>
						Adds a timestamp indicating when the page was loaded to any page, in the preferred
						location.
					</li>
					<li>Here are some format examples:</li>
					<ul>
						<li>Jan 1, 2017 - MMM d, yyyy</li>
						<li>Jan 01, 2017 - MMM dd, yyyy</li>
						<li>01/01/2017 - dd/MM/yyyy</li>
						<li>2017/01/01 - yyyy/MM/dd</li>
						<li>6:00 - H:mm</li>
						<li>6:00 AM - h:mm a</li>
						<li>06:00 - HH:mm</li>
						<li>06:00:00 - HH:mm:ss</li>
					</ul>
					<li>
						For supported date templates, refer to the{' '}
						<a href="https://www.steamgifts.com/account/settings/profile?esgst=settings&id=at">
							Accurate Timestamp
						</a> setting's description.
					</li>
				</ul>
			),
			id: 'plt',
			name: 'Page Load Timestamp',
			inputItems: [
				{
					id: 'plt_format',
					prefix: `Timestamp format: `,
				},
			],
			options: {
				title: `Position:`,
				values: ['Sidebar', 'Footer'],
			},
			sg: true,
			st: true,
			type: 'general',
		};
	}

	init() {
		const userFormat = Settings.get('plt_format');
		const defaultFormat = 'MMM dd, yyyy, HH:mm:ss';
		const timestamp = format(Date.now(), userFormat || defaultFormat) || format(Date.now(), defaultFormat);
		
		switch (Settings.get('plt_index')) {
			case 0:
				if (this.esgst.sidebar) {
					DOM.insert(
						this.esgst.sidebar,
						'afterbegin',
						<span className="esgst-plt">
							<h3 className="sidebar__heading">Page Load Timestamp</h3>
							<div className="sidebar__navigation">{timestamp}</div>
						</span>
					);
					break;
				}
			case 1: {
				if (!Shared.footer) {
					return;
				}

				const linkContainer = Shared.footer.addLinkContainer({
					name: `Page loaded on ${timestamp}`,
					side: 'left',
				});

				linkContainer.nodes.outer.classList.add('esgst-plt');

				break;
			}
		}
	}
}

const generalPageLoadTimestamp = new GeneralPageLoadTimestamp();

export { generalPageLoadTimestamp };
