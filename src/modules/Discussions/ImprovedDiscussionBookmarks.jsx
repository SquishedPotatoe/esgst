import { Button } from '../../class/Button';
import { Module } from '../../class/Module';
import { Settings } from '../../class/Settings';
import { Shared } from '../../class/Shared';
import { Popup } from '../../class/Popup';
import { FetchRequest } from '../../class/FetchRequest';
import { Session } from '../../class/Session';
import { DOM } from '../../class/DOM';

class DiscussionsImprovedDiscussionBookmarks extends Module {
	constructor() {
		super();

		this.info = {
			description: () => (
				<ul>
					<li>
						Replaces the native <i className="fa fa-bookmark"></i> button if the discussion is
						bookmarked and adds a <i className="fa fa-bookmark-o"></i> button if it is not, next to
						a discussion's title (in any page) that allows you to add / remove the discussion to /
						from SteamGifts' native bookmark list.
					</li>
					<li>Bookmarked discussions have a green background.</li>
				</ul>
			),
			features: {
				idb_t: {
					name: 'Pin any bookmarked discussions in the page.',
					sg: true,
				},
			},
			id: 'idb',
			name: 'Improved Discussion Bookmarks',
			sg: true,
			type: 'discussions',
		};
	}

	init() {
		const highlightedDiscussions = {};

		for (const code in Shared.esgst.discussions) {
			const discussion = Shared.esgst.discussions[code];

			if (discussion.highlighted) {
				highlightedDiscussions[code] = {
					highlighted: null,
				};
			}
		}

		const numHighlightedDiscussions = Object.keys(highlightedDiscussions).length;

		if (numHighlightedDiscussions > 0) {
			const popup = new Popup({
				addProgress: true,
				icon: 'fa-exchange',
				isTemp: true,
				title:
					'Discussion Highlighter has been renamed to Improved Discussion Bookmarks because the ability to bookmark discussions has been added to SteamGifts, so ESGST no longer handles the data. Do you want to transfer the discussions you had previously highlighted to the SteamGifts bookmark list or do you want to delete them from your data?',
				buttons: [
					[
						{
							template: 'success',
							name: 'Transfer',
							onClick: async () => {
								let current = 1;

								for (const code in highlightedDiscussions) {
									await this.bookmarkDiscussion(code);

									popup.progressBar
										.setLoading(
											`${current++} of ${numHighlightedDiscussions} discussions transferred...`
										)
										.show();
								}

								await Shared.common.lockAndSaveDiscussions(highlightedDiscussions);

								popup.close();
							},
						},
						{
							template: 'loading',
							isDisabled: true,
							name: 'Transfering...',
						},
					],
					[
						{
							template: 'error',
							name: 'Delete',
							onClick: async () => {
								await Shared.common.lockAndSaveDiscussions(highlightedDiscussions);

								popup.close();
							},
						},
						{
							template: 'loading',
							isDisabled: true,
							name: 'Deleting...',
						},
					],
				],
			});
			popup.open();
		}

		Shared.esgst.discussionFeatures.push(this.addButtons.bind(this));
	}

	async addButtons(discussions, main) {
		const isBookmarkedPage = /^\/discussions\/bookmarked/.test(window.location.pathname);

		for (const discussion of discussions) {
			if (discussion.idbButton) continue;

			const headingParent = discussion.heading?.parentElement;
			const sgButton = headingParent?.querySelector('.page__heading__button[title*="Bookmark"]');
			const thread = !!sgButton;
			const isBookmarked = thread
				? sgButton.classList.contains('page__heading__button--blue')
				: !!discussion.bookmarked;

			if (sgButton) {
				sgButton.classList.add('esgst-hidden');
			} else if (discussion.bookmarkNode) {
				discussion.bookmarkNode.classList.add('esgst-hidden');
			}

			const context = discussion.outerWrap;

			if (isBookmarked) {
				await this.bookmarkDiscussion(null, !thread && !isBookmarkedPage ? context : null);

				if (Settings.get('idb_t') && main && Shared.esgst.discussionsPath && context) {
					context.parentElement.insertBefore(context, context.parentElement.firstElementChild);
					discussion.isPinned = true;
				}
			}

			discussion.idbButton = new Button(headingParent, 'afterbegin', {
				callbacks: [
					this.bookmarkDiscussion.bind(this, discussion.code, !thread && !isBookmarkedPage ? context : null),
					null,
					this.unbookmarkDiscussion.bind(this, discussion.code, context),
					null,
				],
				className: 'esgst-idb-button',
				icons: [
					'fa-bookmark-o esgst-clickable',
					'fa-circle-o-notch fa-spin',
					thread ? 'fa-bookmark esgst-clickable' : `fa-bookmark esgst-clickable ${discussion.bookmarkNode?.classList.contains('icon-blue') ? 'icon-blue' : ''}`,
					'fa-circle-o-notch fa-spin',
				],
				id: 'idb',
				index: isBookmarked ? 2 : 0,
				titles: [
					'Click to bookmark this discussion',
					'Bookmarking discussion...',
					'Click to unbookmark this discussion',
					'Unbookmarking discussion...',
				],
			});
		}
	}

	async bookmarkDiscussion(code, context) {
		if (code) {
			await FetchRequest.post(`/discussion/${code}/`, {
				data: `xsrf_token=${Session.xsrfToken}&do=bookmark_insert`,
			});
		}

		if (context) {
			context.classList.add('esgst-idb-highlight');
		}

		return true;
	}

	async unbookmarkDiscussion(code, context) {
		if (code) {
			await FetchRequest.post(`/discussion/${code}/`, {
				data: `xsrf_token=${Session.xsrfToken}&do=bookmark_delete`,
			});
		}

		if (context) {
			context.classList.remove('esgst-idb-highlight');
		}

		return true;
	}
}

const discussionsImprovedDiscussionBookmarks = new DiscussionsImprovedDiscussionBookmarks();

export { discussionsImprovedDiscussionBookmarks };
