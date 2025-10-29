import dateFns_formatDistanceStrict from 'date-fns/formatDistanceStrict';
import { Module } from '../../class/Module';
import { Popout } from '../../class/Popout';
import { common } from '../Common';
import { Shared } from '../../class/Shared';
import { Settings } from '../../class/Settings';
import { DOM } from '../../class/DOM';

const createElements = common.createElements.bind(common),
	createHeadingButton = common.createHeadingButton.bind(common),
	setSetting = common.setSetting.bind(common);
class GiveawaysGridView extends Module {
	constructor() {
		super();
		this.info = {
			description: () => (
				<ul>
					<li>
						Turns each giveaway in the main page, groups, game pages, profile pages and some popups(
						<span data-esgst-feature-id="gb"></span>, <span data-esgst-feature-id="ged"></span> and{' '}
						<span data-esgst-feature-id="ge"></span>) into a small box where only the game's image
						is shown. Overlaying the image you will find the start/end times, type and level of the
						giveaway. To get the other details of the giveaway (such as the game name, the number of
						points it costs to enter, the number of entries/comments and the creator's username),
						you can hover over the box and a popout will appear containing them.This allows multiple
						giveaways to be shown per line, which reduces the size of the page and allows you to
						view all of the giveaways in the page at a single glance.
					</li>
					<li>
						Also adds a button (<i className="fa fa-th-large"></i>) to the main page heading of the
						same page that allows you to set the size of the space between each box.
					</li>
				</ul>
			),
			features: {
				gv_gb: {
					name: 'Extend to Giveaway Bookmarks.',
					sg: true,
				},
				gv_ged: {
					name: 'Extend to Giveaway Encrypter / Decrypter.',
					sg: true,
				},
				gv_ge: {
					name: 'Extend to Giveaway Extractor.',
					sg: true,
				},
				gv_gp: {
					description: () => (
						<fragment>
							<ul>
								<li>
									Extends to Game Pages.
								</li>
							</ul>
							<ul>
								<strong>example: </strong>
								<a href="https://www.steamgifts.com/game/Q6JGq/garrys-mod">https://www.steamgifts.com/game/Q6JGq/garrys-mod</a>
							</ul>
						</fragment>
					),
					name: 'Extend to Game Pages.',
					sg: true,
				},
				gv_pro: {
					description: () => (
						<fragment>
							<ul>
								<li>
									Extends to "Gifts Won" and "Gifts Sent" in a user's profile page.
								</li>
							</ul>
							<ul>
								<strong>example: </strong>
								<a href={"https://www.steamgifts.com/user/cg"}>https://www.steamgifts.com/user/cg</a>
							</ul>
						</fragment>
					),
					name: 'Extend to Profile.',
					sg: true,
				},
				gv_grp: {
					name: 'Extend to Groups.',
					sg: true,
				},
			},
			id: 'gv',
			name: 'Grid View',
			sg: true,
			type: 'giveaways',
		};
	}

	init() {
		if (
			this.esgst.giveawaysPath ||
			Settings.get('gv_gb') ||
			Settings.get('gv_ged') ||
			Settings.get('gv_ge') ||
			Settings.get('gv_gp') ||
			Settings.get('gv_pro') ||
			Settings.get('gv_grp')
		) {
			this.esgst.giveawayFeatures.push(this.gv_setContainer.bind(this));
			this.esgst.style.insertAdjacentText(
				'beforeend',
				`
				.esgst-gv-creator {
					margin: ${Settings.get('ib') ? 10 : 5}px 5px 5px;
				}

				.esgst-gv-popout .giveaway__links {
					display: block;
					height: auto;
					margin: 5px 5px ${Settings.get('ib') ? 10 : 5}px;
					text-align: center;
				}
			`
			);
			if ((this.esgst.groupPath && Settings.get('gv_grp')) || (this.esgst.gamePath && Settings.get('gv_gp')) || this.esgst.giveawaysPath || (this.esgst.userPath && Settings.get('gv_pro'))) {
				let button, display, element, elements, i, n, popout, spacing, slider;
				button = createHeadingButton({
					id: 'gv',
					icons: ['fa-th-large'],
					title: 'Set Grid View spacing',
				});
				popout = new Popout('esgst-gv-spacing', button, 0, true);
				spacing = Settings.get('gv_spacing');
				element = DOM.insert(popout.popout, 'beforeend', (
					<div className="ui-slider">
						<input
							type="range"
							min="0"
							max="10"
							value={spacing}
							className="esgst-gv-slider ui-slider-range"
							ref={(ref) => (slider = ref)}
							oninput={(e) => updateSpacing(e.target.value)}
						/>
						<div className="esgst-gv-slider-display" ref={(ref) => (display = ref)}>
							{spacing}px
						</div>
					</div>
				));

				function updateSliderFill(slider) {
					const val = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
					slider.style.setProperty('--progress', `${val}%`);
				}

				function updateSpacing(value) {
					spacing = parseInt(value, 10);
					const elements = document.getElementsByClassName('esgst-gv-container');
					for (let i = 0, n = elements.length; i < n; ++i) {
						elements[i].style.margin = `${spacing}px`;
					}
					popout.reposition();
					display.textContent = `${spacing}px`;
					setSetting('gv_spacing', spacing);
					updateSliderFill(slider);
				}
				updateSliderFill(slider);
			}
		}
	}

	gv_setContainer(giveaways, main, source) {
		if (
			(!main || !((this.esgst.groupPath && Settings.get('gv_grp')) || (this.esgst.gamePath && Settings.get('gv_gp')) || this.esgst.giveawaysPath || (this.esgst.userPath && Settings.get('gv_pro')))) &&
			(main ||
				((source !== 'gb' || !Settings.get('gv_gb')) &&
					(source !== 'ged' || !Settings.get('gv_ged')) &&
					(source !== 'ge' || !Settings.get('gv_ge'))))
		)
			return;
		let username, avatar;
		if (this.esgst.userPath && !this.esgst.userWonPath) {
			avatar = document
				.getElementsByClassName('global__image-inner-wrap')[0]
				.style.backgroundImage.match(/\("(.+)"\)/)[1];
			username = document
				.getElementsByClassName('featured__heading__medium')[0].textContent;
		}
		giveaways.forEach((giveaway) => {
			giveaway.grid = true;
			let popup =
				giveaway.outerWrap.closest('.esgst-popup-scrollable') ||
				(Shared.common.isCurrentPath('Account') && this.esgst.parameters.esgst);
			if (popup) {
				giveaway.outerWrap.parentElement.parentElement.classList.add('esgst-gv-view');
				giveaway.outerWrap.parentElement.style.display = 'inline-block';
				giveaway.outerWrap.classList.add('esgst-gv-container');
				giveaway.outerWrap.style.margin = `${Settings.get('gv_spacing')}px`;
			} else {
				giveaway.outerWrap.parentElement.classList.add('esgst-gv-view');
				giveaway.outerWrap.classList.add('esgst-gv-container');
				giveaway.outerWrap.style.margin = `${Settings.get('gv_spacing')}px`;
			}
			giveaway.innerWrap.classList.add('esgst-gv-box');
			const now = Date.now();
			giveaway.gvIcons = createElements(giveaway.innerWrap, 'afterbegin', [
				{
					attributes: {
						class: 'esgst-gv-icons giveaway__columns',
					},
					type: 'div',
					children: [
						{
							attributes: {
								class: 'esgst-gv-time',
								['data-draggable-id']: 'time',
								draggable: true,
							},
							type: 'div',
							children: [
								{
									attributes: {
										title: `${giveaway.started ? 'Ends' : 'Starts'} ${
											giveaway.endTimeColumn.lastElementChild.textContent
										}`,
									},
									// @ts-ignore
									text: dateFns_formatDistanceStrict(giveaway.endTime, now, {
										locale: this.esgst.formatDistanceLocale,
									}),
									type: 'span',
								},
								{
									attributes: {
										class: 'fa fa-clock-o',
									},
									type: 'i',
								},
								{
									attributes: {
										title: `Created ${giveaway.startTimeColumn.firstElementChild.textContent}`,
									},
									// @ts-ignore
									text: dateFns_formatDistanceStrict(giveaway.startTime, now, {
										locale: this.esgst.formatDistanceLocale,
									}),
									type: 'span',
								},
							],
						},
					],
				},
			]);
			giveaway.endTimeColumn_gv = giveaway.gvIcons.firstElementChild.firstElementChild;
			if (giveaway.inviteOnly) {
				giveaway.gvIcons.appendChild(giveaway.inviteOnly);
			}
			if (giveaway.regionRestricted) {
				giveaway.gvIcons.appendChild(giveaway.regionRestricted);
			}
			if (giveaway.group) {
				giveaway.gvIcons.appendChild(giveaway.group);
			}
			if (giveaway.whitelist) {
				giveaway.gvIcons.appendChild(giveaway.whitelist);
			}
			if (giveaway.levelColumn) {
				giveaway.levelColumn.textContent = giveaway.levelColumn.textContent.replace(/Level\s/, '');
				giveaway.gvIcons.appendChild(giveaway.levelColumn);
			}
			giveaway.innerWrap.insertBefore(giveaway.image, giveaway.gvIcons);
			giveaway.summary.classList.add('esgst-gv-popout', 'global__image-outer-wrap');
			let temp;
			DOM.insert(
				giveaway.links,
				'beforebegin',
				<div
					style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}
					ref={(ref) => (temp = ref)}
				>
					<div style={{ display: 'flex', flex: '1', flexDirection: 'column' }}>
						<div className="esgst-gv-creator">by </div>
					</div>
				</div>
			);
			if (this.esgst.userPath && !this.esgst.userWonPath && source !== 'gb') {
				giveaway.creatorContainer = (<a className="giveaway__username" href={`/user/${username}`}> {username}</a>);
				giveaway.avatar = (<a href={`/user/${username}`} className="giveaway_image_avatar" style={`background-image:url(${avatar});`}></a>);
			}
			temp.firstElementChild.firstElementChild.appendChild(giveaway.creatorContainer);
			temp.firstElementChild.appendChild(giveaway.links);
			temp.appendChild(giveaway.avatar);
			temp.after(giveaway.endTimeColumn.nextElementSibling);
			giveaway.endTimeColumn.classList.add('esgst-hidden');
			giveaway.startTimeColumn.classList.add('esgst-hidden');
			giveaway.entriesLink.lastElementChild.textContent = giveaway.entriesLink.textContent.replace(
				/[^\d,]+/g,
				''
			);
			giveaway.commentsLink.lastElementChild.textContent = giveaway.commentsLink.textContent.replace(
				/[^\d,]+/g,
				''
			);
			new Popout('', giveaway.outerWrap, 100, false, giveaway.summary);
		});
	}
}

const giveawaysGridView = new GiveawaysGridView();

export { giveawaysGridView };
