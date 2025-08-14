import { Module } from '../class/Module';
import { Scope } from '../class/Scope';
import { Settings } from '../class/Settings';

class Groups extends Module {
	constructor() {
		super();
		this.info = {
			endless: true,
			id: 'groups',
			featureMap: {
				endless: this.groups_load.bind(this),
			},
		};
	}

	async groups_load(context, main, source, endless) {
		const elements = context.querySelectorAll(
			`${endless
				? `.esgst-es-page-${endless} a[href*="/group/"]:not(.table_image_avatar), .esgst-es-page-${endless}a[href*="/group/"]:not(.table_image_avatar)`
				: `a[href*="/group/"]:not(.table_image_avatar)`
			}, .form_list_item_summary_name`
		);
		if (!elements.length) {
			return;
		}
		const groups = [];
		for (const element of elements) {
			if (element.children.length || element.closest('.markdown')) {
				continue;
			}
			const group = {
				saved: null,
				url: element.getAttribute('href'),
			};
			if (group.url) {
				const match = group.url.match(/\/group\/(.+?)\//);
				if (match) {
					group.id = match[1];
					group.saved = this.esgst.groups.filter((x) => x.code === group.id)[0];
				}
			}
			if (!group.id) {
				const avatarImage = element.parentElement.previousElementSibling;
				if (avatarImage?.style?.backgroundImage) {
					const avatar = avatarImage.style.backgroundImage;
					group.saved = this.esgst.groups.filter((x) => avatar.match(x.avatar))[0];
					group.id = group.saved && group.saved.code;
				}
			}
			if (!group.id) {
				continue;
			}
			group.code = group.id;
			if (!this.esgst.currentGroups[group.id]) {
				this.esgst.currentGroups[group.id] = {
					elements: [],
					savedGroup: group.saved,
				};
			}
			if (this.esgst.currentGroups[group.id].elements.indexOf(element) > -1) {
				continue;
			}
			const hasTextContent = element.textContent?.trim();
			const fallbackName = group.url?.replace('/group/', '')?.split('/')?.pop()?.replace(/[-_]+/g, ' ') ?? '';
			if (hasTextContent) {
				group.name = hasTextContent;
			} else {
				group.name = fallbackName || group.id || 'Unknown Group';
			}
			const container = element.parentElement;
			group.oldElement = element;
			if (this.esgst.groupPath && container.classList.contains('page__heading__breadcrumbs')) {
				group.element = document.getElementsByClassName('featured__heading__medium')[0];
				group.container = group.element?.parentElement;
			} else {
				group.element = element;
				group.container = container;
			}
			if (!hasTextContent) {
				let nameContainer =
					element.closest('.table__row-inner-wrap')?.querySelector('.table__column--width-fill') ||
					element.closest('.form_list_item_summary') ||
					element.parentElement;
				group.context = nameContainer;
				group.container = nameContainer;
				const existingHeading = group.context.querySelector('.table__column__heading');
				if (!existingHeading?.textContent.trim() && group.name && group.url) {
					const nameLink = document.createElement('a');
					nameLink.href = group.url;
					nameLink.className = 'table__column__heading';
					nameLink.textContent = group.name;
					const avatarLink = group.context.querySelector('a.table_image_avatar');
					if (avatarLink && avatarLink.parentElement === group.context) {
						avatarLink.insertAdjacentElement('afterend', nameLink);
					} else {
						group.context.insertBefore(nameLink, group.context.firstChild);
					}
				}
				if (this.esgst.groupPath) {
					const breadcrumbs = document.querySelector('.page__heading__breadcrumbs');
					const breadcrumbLink = breadcrumbs?.querySelector('a[href*="/group/"]');
					if (breadcrumbLink && breadcrumbLink.textContent.trim().length === 0) {
						breadcrumbLink.textContent = group.name;
					}
					const heading = document.querySelector('.featured__heading__medium');
					if (heading && heading.textContent.trim().length === 0) {
						heading.textContent = group.name;
					}
				}
			} else {
				group.context = group.element;
			}
			this.esgst.currentGroups[group.id].elements.push(group.element);
			group.innerWrap = element.closest('.table__row-inner-wrap') || group.container;
			group.outerWrap = element.closest('.table__row-outer-wrap') || group.container;
			const isHeading = group.context?.classList.contains('featured__heading__medium');
			if (isHeading) {
				group.tagContext = group.container;
				group.tagPosition = 'beforeend';
			} else if (hasTextContent) {
				group.tagContext = group.context;
				group.tagPosition = 'afterend';
			} else {
				group.tagContext = group.container.firstElementChild || group.container;
				group.tagPosition = 'afterend';
			}
			groups.push(group);
		}
		Scope.addData('current', 'groups', groups, endless);
		if (
			main &&
			this.esgst.gpf &&
			this.esgst.gpf.filteredCount &&
			Settings.get(`gpf_enable${this.esgst.gpf.type}`)
		) {
			this.esgst.modules.groupsGroupFilters.filters_filter(this.esgst.gpf, false, endless);
		}
		for (const feature of this.esgst.groupFeatures) {
			await feature(groups, main, source, endless);
		}
	}
}

const groupsModule = new Groups();

export { groupsModule };
