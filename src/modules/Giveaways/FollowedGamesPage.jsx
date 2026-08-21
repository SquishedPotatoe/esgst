import { DOM } from '../../class/DOM';
import { FetchRequest } from '../../class/FetchRequest';
import { Module } from '../../class/Module';
import { Shared } from '../../class/Shared';
import { Button } from '../../components/Button';

class GiveawaysFollowedGamesPage extends Module {
	constructor() {
		super();
		this.info = {
			description: () => (
				<ul>
					<li>
						Adds a new giveaway page where you can see open giveaways for all of your followed
						games.
					</li>
					<li>To access this page, use the sidebar navigation from the main page.</li>
				</ul>
			),
			id: 'fgp',
			name: 'Followed Games Page',
			sg: true,
			type: 'giveaways',
		};
	}

	init() {
		Shared.esgst.customPages.fgp = {
			check: Shared.common.isCurrentPath('Browse Giveaways'),
			load: async () => await this.load(),
		};
		const sidebarLink = document.querySelector(
			'.sidebar__navigation__item__link[href="/giveaways/search?type=wishlist"]'
		);
		if (sidebarLink) {
			DOM.insert(
				sidebarLink.parentElement,
				'afterend',
				<li className="sidebar__navigation__item" id="esgst-fgp">
					<a className="sidebar__navigation__item__link" href="/giveaways/search?esgst=fgp">
						<div className="sidebar__navigation__item__name">Followed</div>
						<div className="sidebar__navigation__item__underline"></div>
					</a>
				</li>
			);
			if (Shared.esgst.parameters.esgst === 'fgp') {
				Shared.common.setSidebarActive('esgst-fgp');
			}
		}
	}

	async load() {
		const obj = {
			container: Shared.esgst.pagination?.previousElementSibling,
			count: 0,
			displayed: 0,
			leftovers: [],
			page: 1,
			perPage: 50,
			reachedEnd: false,
			results: Shared.esgst.pagination?.querySelector('.pagination__results'),
			set: null,
			url: Shared.esgst.searchUrl,
		};
		if (!obj.container) return;

		if (Shared.esgst.pinnedGiveaways) {
			await Shared.common.endless_load(Shared.esgst.pinnedGiveaways, true);
		}

		if (Shared.esgst.es) {
			Shared.esgst.es.paused = true;
			const buttonIds = [
				'esgst-esPause','esgst-esResume','esgst-esContinuous','esgst-esNext','esgst-esRefresh','esgst-esRefreshAll',
			];
			for (const id of buttonIds) {
				const element = document.getElementById(id);
				if (element) {
					element.classList.add('esgst-hidden');
				}
			}
		}
		if (Shared.esgst.paginationNavigation) {
			Shared.esgst.paginationNavigation.classList.add(Shared.esgst.hiddenClass);
		}
		if (obj.results) {
			obj.results.classList.add(Shared.esgst.hiddenClass);
		}
		obj.container.innerHTML = '';
		obj.button = Button.create([
			{
				color: 'green',
				icons: [],
				name: 'Load More',
				onClick: async () => await this.loadNextPage(obj),
			},
			{
				color: 'white',
				isDisabled: true,
				icons: [],
				name: 'Loading...',
			},
		]).insert(obj.container, 'beforeend');
		obj.button.onClick();
	}

	updatePaginationResults(obj) {
		if (!obj.results) return;
		const values = obj.results.getElementsByTagName('strong');
		if (values.length < 2) return;
		values[0].textContent = obj.displayed > 0 ? '1' : '0';
		values[1].textContent = `${obj.displayed}`;
		obj.results.classList.remove(Shared.esgst.hiddenClass);
	}

	showNoResults(obj) {
		if (!obj.container || !Shared.esgst.pagination) return;
		obj.container.classList.add(Shared.esgst.hiddenClass);
		Shared.esgst.pagination.classList.add('pagination--no-results');
		Shared.esgst.pagination.innerHTML =
			'<div class="pagination__results">No results were found.</div>';
	}

	async loadNextPage(obj) {
		let context;
		DOM.insert(obj.button.nodes.outer, 'beforebegin', <div className="esgst-fgp esgst-hidden" ref={(ref) => (context = ref)} />);
		obj.count = 0;
		while (obj.leftovers.length > 0 && obj.count < obj.perPage) {
			const leftover = obj.leftovers.splice(0, 1)[0];
			context.appendChild(leftover);
			obj.count += 1;
			obj.displayed += 1;
		}
		if (obj.count < obj.perPage && !obj.reachedEnd) {
			do {
				const response = await FetchRequest.get(`${obj.url}${obj.page}`);
				const html = response.html;
				const elements = html.querySelectorAll('.giveaway__row-outer-wrap');
				for (const element of elements) {
					const gameInfo = await Shared.esgst.modules.games.games_getInfo(element);
					if (
						gameInfo &&
						Shared.esgst.games[gameInfo.type][gameInfo.id] &&
						Shared.esgst.games[gameInfo.type][gameInfo.id].followed
					) {
						if (obj.count < obj.perPage) {
							context.appendChild(element.cloneNode(true));
							obj.count += 1;
							obj.displayed += 1;
						} else {
							obj.leftovers.push(element.cloneNode(true));
						}
					}
				}
				obj.page += 1;
				const pagination = html.querySelector('.pagination__navigation');
				obj.reachedEnd =
					!pagination || pagination.lastElementChild.classList.contains(Shared.esgst.selectedClass);
			} while (!obj.reachedEnd && obj.count < obj.perPage);
		}
		this.updatePaginationResults(obj);
		if (!obj.displayed && obj.reachedEnd) {
			context.remove();
			this.showNoResults(obj);
			obj.button.destroy();
			return;
		}
		if (context.children.length > 0) {
			context.classList.remove('esgst-hidden');
			await Shared.common.endless_load(context, true);
			if (obj.container && obj.button?.nodes?.outer && !obj.reachedEnd) {
				obj.container.appendChild(obj.button.nodes.outer);
			}
		} else {
			context.remove();
		}
		if (obj.reachedEnd && obj.leftovers.length === 0) {
			obj.button.destroy();
		}
	}
}

const giveawaysFollowedGamesPage = new GiveawaysFollowedGamesPage();

export { giveawaysFollowedGamesPage };
