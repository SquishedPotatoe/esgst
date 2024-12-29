import { Module } from '../../class/Module';
import { Settings } from '../../class/Settings';
import { Shared } from '../../class/Shared';
import { DOM } from '../../class/DOM';

class DiscussionsReversedActiveDiscussions extends Module {
	constructor() {
		super();
		this.info = {
			description: () => (
				<ul>
					<li>
						Reverses the active discussions so that discussions come before deals
						(original order).
					</li>
				</ul>
			),
			id: 'rad',
			name: 'Reversed Active Discussions',
			sg: true,
			sgPaths: /^Discussion|Giveaway|Browse\sGiveaways/,
			type: 'discussions',
		};
	}

	async init() {
		if (!(this.esgst.giveawaysPath || this.esgst.commentsPath || this.esgst.activeDiscussions) || Settings.get('oadd')) {
			return;
		}
		Shared.esgst.activeDiscussions.insertBefore(
			Shared.esgst.activeDiscussions.lastElementChild,
			Shared.esgst.activeDiscussions.firstElementChild
		);
	}
}

const discussionsReversedActiveDiscussions = new DiscussionsReversedActiveDiscussions();

export { discussionsReversedActiveDiscussions };
