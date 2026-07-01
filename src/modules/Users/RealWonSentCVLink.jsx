import { Module } from '../../class/Module';
import { common } from '../Common';
import { DOM } from '../../class/DOM';

const createElements = common.createElements.bind(common),
	getFeatureTooltip = common.getFeatureTooltip.bind(common);
class UsersRealWonSentCVLink extends Module {
	constructor() {
		super();
		this.info = {
			description: () => (
				<ul>
					<li>
						Turns "Gifts Won" and "Gifts Sent" in a user's{' '}
						<a href="https://www.steamgifts.com/user/cg">profile</a> page into links that take you
						to their real won/sent CV pages on <a href="https://www.sgtools.info/">SGTools</a>.
					</li>
				</ul>
			),
			id: 'rwscvl',
			name: 'Real Won/Sent CV Link',
			sg: true,
			type: 'users',
			featureMap: {
				profile: this.rwscvl_add.bind(this),
			},
		};
	}

	rwscvl_add(profile) {
		let sentUrl, wonUrl;
		wonUrl = `http://www.sgtools.info/real-cv/${profile.username}/won`;
		sentUrl = `http://www.sgtools.info/real-cv/${profile.username}/sent`;

		createElements(profile.wonRowLeft, 'atinner', [
			{
				attributes: {
					class: 'esgst-rwscvl-link',
					href: wonUrl,
					target: '_blank',
					title: getFeatureTooltip('rwscvl'),
				},
				text: 'Gifts Won',
				type: 'a',
			},
		]);
		createElements(profile.sentRowLeft, 'atinner', [
			{
				attributes: {
					class: 'esgst-rwscvl-link',
					href: sentUrl,
					target: '_blank',
					title: getFeatureTooltip('rwscvl'),
				},
				text: 'Gifts Sent',
				type: 'a',
			},
		]);
	}
}

const usersRealWonSentCVLink = new UsersRealWonSentCVLink();

export { usersRealWonSentCVLink };
