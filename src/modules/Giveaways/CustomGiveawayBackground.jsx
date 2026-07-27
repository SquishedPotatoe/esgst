import { Module } from '../../class/Module';
import { Settings } from '../../class/Settings';
import { DOM } from '../../class/DOM';

class GiveawaysCustomGiveawayBackground extends Module {
	constructor() {
		super();
		this.info = {
			description: () => (
				<ul>
					<li>
						Allows you to color the background of giveaways based on their type (public, invite
						only, region restricted, group or whitelist) and level.
					</li>
				</ul>
			),
			features: {
				cgb_gv: {
					description: () => (
						<ul>
							<li>
								Shows a colored border on top of the giveaway in Grid View
							</li>
						</ul>
					), name: 'Enable for Grid View.',
					sg: true,
				},
				cgb_brd: {
					name: 'Use border on top instead of background',
					sg: true,
				},
				cgb_b: {
					background: true,
					name: 'Color giveaways that cannot be entered because of blacklist reasons.',
					sg: true,
				},
				cgb_p: {
					background: true,
					name: 'Color public giveaways.',
					sg: true,
				},
				cgb_io: {
					background: true,
					name: 'Color invite only giveaways.',
					sg: true,
				},
				cgb_rr: {
					background: true,
					name: 'Color region restricted giveaways.',
					sg: true,
				},
				cgb_g: {
					background: true,
					name: 'Color group giveaways.',
					sg: true,
				},
				cgb_w: {
					background: true,
					name: 'Color whitelist giveaways.',
					sg: true,
				},
				cgb_sgt: {
					background: true,
					name: 'Color SGTools giveaways.',
					sg: true,
				},
			},
			featureMap: {
				giveaway: this.color.bind(this),
			},
			id: 'cgb',
			name: 'Custom Giveaway Background',
			sg: true,
			type: 'giveaways',
		};
	}

	color(giveaways) {
		if (this.esgst.giveawayPath || this.esgst.createdPath || this.esgst.enteredPath || this.esgst.wonPath || (Settings.get('gv') && !Settings.get('cgb_gv')))
			return;
		const classesToAdd = ['esgst-cgb'];
		if (Settings.get('cgb_brd')) {
			classesToAdd.push('esgst-cgb-border');
		}
		for (const giveaway of giveaways) {
			giveaway.outerWrap.classList.add(...classesToAdd);
			const matchedColors = [];
			if (Settings.get('cgb_b') && giveaway.outerWrap.getAttribute('data-blacklist')) {
				matchedColors.push(Settings.get('cgb_b_bgColor'));
			}
			if (Settings.get('cgb_sgt') && giveaway.sgTools) {
				matchedColors.push(Settings.get('cgb_sgt_bgColor'));
			}
			const { color: levelColor } = Settings.get('cgb_levelColors').filter(
				(colors) =>
					giveaway.level >= parseInt(colors.lower) && giveaway.level <= parseInt(colors.upper)
			)[0] || { color: undefined };

			if (levelColor) {
				matchedColors.push(levelColor);
			}
			if (Settings.get('cgb_w') && giveaway.whitelist) {
				matchedColors.push(Settings.get('cgb_w_bgColor'));
			}
			if (Settings.get('cgb_g') && giveaway.group) {
				matchedColors.push(Settings.get('cgb_g_bgColor'));
			}
			if (Settings.get('cgb_rr') && giveaway.regionRestricted) {
				matchedColors.push(Settings.get('cgb_rr_bgColor'));
			}
			if (Settings.get('cgb_io') && giveaway.inviteOnly) {
				matchedColors.push(Settings.get('cgb_io_bgColor'));
			}
			if (Settings.get('cgb_p') && giveaway.public) {
				matchedColors.push(Settings.get('cgb_p_bgColor'));
			}
			if (matchedColors.length >= 2) {
				const count = matchedColors.length;
				const blockWidth = 100 / count;
				const gradientParts = [];

				matchedColors.forEach((color, index) => {
					const startPos = index * blockWidth;
					const endPos = startPos + blockWidth;
					gradientParts.push(`${color} ${startPos.toFixed(1)}%`);
					gradientParts.push(`${color} ${endPos.toFixed(1)}%`);
				});
				giveaway.outerWrap.style.setProperty(
					'background-image',
					`linear-gradient(to right, ${gradientParts.join(', ')})`,
					'important'
				);
			} else if (matchedColors.length === 1) {
				giveaway.outerWrap.style.setProperty(
					'background-image',
					`linear-gradient(${matchedColors[0]}, ${matchedColors[0]})`,
					'important'
				);
			} else {
				giveaway.outerWrap.style.backgroundImage = 'none';
			}
		}
	}
}

const giveawaysCustomGiveawayBackground = new GiveawaysCustomGiveawayBackground();

export { giveawaysCustomGiveawayBackground };
