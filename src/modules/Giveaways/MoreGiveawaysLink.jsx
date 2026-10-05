import { DOM } from '../../class/DOM';
import { Module } from '../../class/Module';
import { Settings } from '../../class/Settings';

const GAME_PAGE_SUFFIXES = ['open', 'coming-soon', 'closed', 'deleted'];

class GiveawaysMoreGiveawaysLink extends Module {
	constructor() {
		super();
		this.info = {
			description: () => (
				<ul>
					<li>
						Allows choosing your preferred default destination for the '<i className="fa fa-fw fa-search"></i>More Giveaways ' link.
						(open, coming-soon, closed, or deleted).
					</li>
				</ul>
			),
			id: 'mgl',
			name: 'More Giveaways Link',
			endless: true,
			options: {
				title: 'Destination:',
				values: ['Open', 'Coming Soon', 'Closed', 'Deleted'],
			},
			sg: true,
			type: 'giveaways',
			featureMap: {
				endless: this.mgl_updateLinks.bind(this),
			},
		};
	}

	mgl_updateLinks(context, main, source) {
		const suffix = GAME_PAGE_SUFFIXES[Settings.get('mgl_index') || 0];
		if (
			!suffix ||
			(!main ||
				!(
					Settings.get('mgl') &&
					(this.esgst.giveawaysPath ||
						this.esgst.giveawayPath ||
						this.esgst.archivePath ||
						this.esgst.gamePath ||
						this.esgst.groupPath ||
						this.esgst.userPath)
				)) &&
			(main ||
				((source !== 'gb' && source !== 'ge' && source !== 'ged') ||
					!Settings.getFull('mgl_sg')?.enabled))
		) {
			return;
		}
		const links = context.querySelectorAll(
			'.giveaway__heading a[href^="/game/"], .featured__heading a[href^="/game/"]'
		);
		for (const link of links) {
			if (!link.querySelector('.fa-search')) {
				continue;
			}
			const baseUrl = link.getAttribute('href').replace(/\/(?:open|coming-soon|closed|deleted)\/?$/, '');
			link.setAttribute('href', `${baseUrl}/${suffix}`);
			link.setAttribute('data-draggable-id', 'search');
		}
	}
}

const giveawaysMoreGiveawaysLink = new GiveawaysMoreGiveawaysLink();

export { giveawaysMoreGiveawaysLink };
