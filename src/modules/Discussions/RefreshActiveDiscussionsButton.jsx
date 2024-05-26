import { Module } from '../../class/Module';
import { common } from '../Common';
import { Settings } from '../../class/Settings';
import { DOM } from '../../class/DOM';

const checkMissingDiscussions = common.checkMissingDiscussions.bind(common),
	getFeatureTooltip = common.getFeatureTooltip.bind(common);
class DiscussionsRefreshActiveDiscussionsButton extends Module {
	constructor() {
		super();
		this.info = {
			description: () => (
				<ul>
					<li>
						Adds a button (<i className="fa fa-refresh"></i>) to the page heading of the active
						discussions that allows you to refresh the active discussions without
						having to refresh the entire page.
					</li>
				</ul>
			),
			id: 'radb',
			name: 'Refresh Active Discussions Button',
			sg: true,
			sgPaths: /^Discussion|Giveaway|Browse\sGiveaways/,
			type: 'discussions',
		};
	}

	init() {
		if (!(this.esgst.giveawaysPath || this.esgst.discussionPath || this.esgst.giveawayPath || this.esgst.activeDiscussions) || (Settings.get('oadd') || Settings.get('adots'))) {
			return;
		}
		this.radb_addButtons();
	}

	radb_addButtons() {
		let elements, i;
		elements = this.esgst.activeDiscussions.querySelectorAll(
			`.block_header, .esgst-heading-button`
		);
		for (i = elements.length - 1; i > -1; --i) {
			DOM.insert(
				elements[i],
				'beforebegin',
				<div
					className={`esgst-radb-button${Settings.get('oadd') ? '' : ' block_header'}`}
					title={getFeatureTooltip('radb', 'Refresh active discussions/deals')}
					onclick={(event) => {
						let icon = event.currentTarget.firstElementChild;
						icon.classList.add('fa-spin');
						if (Settings.get('oadd')) {
							// noinspection JSIgnoredPromiseFromCall
							this.esgst.modules.discussionsOldActiveDiscussionsDesign.oadd_load(true, () => {
								icon.classList.remove('fa-spin');
							});
						} else {
							checkMissingDiscussions(true, () => {
								icon.classList.remove('fa-spin');
							});
						}
					}}
				>
					<i className="fa fa-refresh"></i>
				</div>
			);
		}
	}
}

const discussionsRefreshActiveDiscussionsButton = new DiscussionsRefreshActiveDiscussionsButton();

export { discussionsRefreshActiveDiscussionsButton };
