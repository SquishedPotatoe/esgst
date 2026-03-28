import { Checkbox } from '../../class/Checkbox';
import { Module } from '../../class/Module';
import { Popout } from '../../class/Popout';
import { common } from '../Common';
import { Settings } from '../../class/Settings';
import { DOM } from '../../class/DOM';

const createElements = common.createElements.bind(common),
	getFeatureTooltip = common.getFeatureTooltip.bind(common),
	observeChange = common.observeChange.bind(common),
	triggerOnEnter = common.triggerOnEnter.bind(common);
class GiveawaysAdvancedGiveawaySearch extends Module {
	constructor() {
		super();
		this.info = {
			description: () => (
				<ul>
					<li>
						Adds a panel below the search field of the main page that allows you to easily search
						for giveaways using SteamGifts'{' '}
						<a href="https://www.steamgifts.com/discussion/8SzdT/">search parameters</a>.
					</li>
				</ul>
			),
			id: 'ags',
			name: 'Advanced Giveaway Search',
			sg: true,
			type: 'giveaways',
		};
	}

	init() {
		let query = '';
		if (this.esgst.giveawaysPath) query += `.sidebar__search-container, `;
		if (Settings.get('qgs')) query += `.esgst-qgs-container, `;
		if (!query) return;

		const elements = document.querySelectorAll(query.slice(0, -2));
		for (const element of elements) this.ags_addPanel(element);
	}

	ags_parseUrlParams() {
		const params = new URLSearchParams(window.location.search);
		const result = {};
		for (const [key, value] of params.entries()) result[key] = value;
		return result;
	}

	ags_addPanel(context) {
		const qgs = context.classList.contains('esgst-qgs-container');
		const obj = {
			qgs,
			filters: [],
			urlParams: this.ags_parseUrlParams()
		};

		context.firstElementChild.remove();

		obj.input = createElements(context, 'afterbegin', [
			{
				attributes: {
					class: `${qgs ? 'esgst-qgs-input' : 'sidebar__search-input'}`,
					placeholder: 'Search...',
					type: 'text',
				},
				type: 'input',
			},
		]);

		const icon = obj.input.nextElementSibling;
		icon.classList.add('esgst-clickable');
		icon.title = getFeatureTooltip('ags', 'Use advanced search');

		if (!qgs) {
			const match = window.location.search.match(/q=(.*?)(&.*?)?$/);
			if (match) obj.input.value = decodeURIComponent(match[1]);
		}

		obj.panel =
			!qgs && ((Settings.get('adots') && Settings.get('adots_index') === 0) || !Settings.get('adots'))
				? createElements(context, 'afterend', [{ type: 'div', attributes: { class: 'esgst-ags-panel' } }])
				: new Popout('esgst-ags-panel', context, 100).popout;

		obj.typeContainer = createElements(obj.panel, 'afterbegin', [
			{ type: 'div', attributes: { class: 'esgst-ags-type-container' } },
		]);
		obj.filtersContainer = createElements(obj.panel, 'beforeend', [
			{ type: 'div', attributes: { class: 'esgst-ags-filters-grid' } },
		]);

		this.ags_buildFilters(obj);

		obj.input.addEventListener(
			'keydown',
			triggerOnEnter.bind(common, this.ags_searchQuery.bind(this, obj))
		);
		icon.addEventListener('click', this.ags_searchQuery.bind(this, obj));
	}

	ags_buildFilters(obj) {
		const filterDefinitions = [
			{
				type: 'select',
				key: 'ags_type',
				label: 'Type',
				parameter: 'type',
				options: [
					['', 'All'],
					['wishlist', 'Wishlist'],
					['recommended', 'Recommended'],
					['group', 'Group'],
					['new', 'New']
				],
				placeholder: 'Select Type'
			},
			{
				type: 'range',
				label: 'Release Date',
				minKey: 'ags_minDate',
				maxKey: 'ags_maxDate',
				minParam: 'release_date_min',
				maxParam: 'release_date_max',
				inputType: 'date',
				placeholderMin: 'From YYYY-MM-DD',
				placeholderMax: 'To YYYY-MM-DD'
			},
			{
				type: 'range',
				label: 'Metascore',
				minKey: 'ags_minScore',
				maxKey: 'ags_maxScore',
				minParam: 'metascore_min',
				maxParam: 'metascore_max',
				placeholderMin: 'Min',
				placeholderMax: 'Max'
			},
			{
				type: 'range',
				label: 'Level',
				minKey: 'ags_minLevel',
				maxKey: 'ags_maxLevel',
				minParam: 'level_min',
				maxParam: 'level_max',
				selectRange: true,
				placeholderMin: 'Min',
				placeholderMax: 'Max'
			},
			{
				type: 'range',
				label: 'Entries',
				minKey: 'ags_minEntries',
				maxKey: 'ags_maxEntries',
				minParam: 'entry_min',
				maxParam: 'entry_max',
				placeholderMin: 'Min',
				placeholderMax: 'Max'
			},
			{
				type: 'range',
				label: 'Copies',
				minKey: 'ags_minCopies',
				maxKey: 'ags_maxCopies',
				minParam: 'copy_min',
				maxParam: 'copy_max',
				placeholderMin: 'Min',
				placeholderMax: 'Max'
			},
			{
				type: 'range',
				label: 'Points',
				minKey: 'ags_minPoints',
				maxKey: 'ags_maxPoints',
				minParam: 'point_min',
				maxParam: 'point_max',
				placeholderMin: 'Min',
				placeholderMax: 'Max'
			},
			{ type: 'input', key: 'ags_app', label: 'App Id', parameter: 'app', placeholder: 'App ID' },
			{ type: 'input', key: 'ags_sub', label: 'Sub Id', parameter: 'sub', placeholder: 'Sub ID' },
			{ type: 'checkbox', key: 'ags_regionRestricted', label: 'Region Restricted', parameter: 'region_restricted' },
			{ type: 'checkbox', key: 'ags_dlc', label: 'DLC', parameter: 'dlc' }
		];

		for (const def of filterDefinitions) this.ags_renderFilter(obj, def);
	}

	ags_renderFilter(obj, def) {
		const parent = def.key === 'ags_type' ? obj.typeContainer : obj.filtersContainer;
		switch (def.type) {
			case 'select':
				this.ags_renderSelect(parent, obj, def);
				break;
			case 'range':
				this.ags_renderRange(parent, obj, def);
				break;
			case 'checkbox':
				this.ags_renderCheckbox(parent, obj, def);
				break;
			case 'input':
				this.ags_renderTextInput(parent, obj, def);
				break;
		}
	}

	ags_renderSelect(parent, obj, def) {
		const element = createElements(parent, 'beforeend', [
			{
				type: 'div',
				children: [
					{ text: `${def.label} `, type: 'node' },
					{
						type: 'div',
						attributes: { class: 'esgst-ags-filter' },
						children: [
							{
								type: 'select',
								children: [
									{ type: 'option', text: def.placeholder ?? 'Select…', attributes: { disabled: true, selected: true } },
									...def.options.map(([value, name]) => ({
										type: 'option',
										attributes: { value },
										text: name
									}))
								]
							}
						]
					}
				]
			}
		]);

		const select = element.querySelector('select');
		select.value = obj.urlParams[def.parameter] ?? Settings.get(def.key) ?? '';
		observeChange(select, def.key, true, 'value', 'change');
		obj.filters.push({ element: select, property: 'value', parameter: def.parameter });
	}

	ags_renderRange(parent, obj, def) {
		const createInput = () => {
			if (def.selectRange) {
				return {
					type: 'select',
					children: [
						{ type: 'option', text: def.placeholderMin ?? 'Min', attributes: { disabled: true, selected: true } },
						...Array.from({ length: 11 }, (_, i) => ({ type: 'option', text: i }))
					]
				};
			}
			return { type: 'input', attributes: { type: def.inputType || 'text', placeholder: def.placeholderMin } };
		};

		const element = createElements(parent, 'beforeend', [
			{
				type: 'div',
				children: [
					{ text: `${def.label} `, type: 'node' },
					{ type: 'div', attributes: { class: 'esgst-ags-filter' }, children: [createInput()] },
					{
						type: 'div',
						attributes: { class: 'esgst-ags-filter' },
						children: [
							def.selectRange
								? {
										type: 'select',
										children: [
											{ type: 'option', text: def.placeholderMax ?? 'Max', attributes: { disabled: true, selected: true } },
											...Array.from({ length: 11 }, (_, i) => ({ type: 'option', text: i }))
										]
								  }
								: { type: 'input', attributes: { type: def.inputType || 'text', placeholder: def.placeholderMax } }
						]
					}
				]
			}
		]);

		const filterDivs = element.querySelectorAll('.esgst-ags-filter');
		const minEl = filterDivs[0].querySelector('input, select');
		const maxEl = filterDivs[1].querySelector('input, select');

		minEl.value = obj.urlParams[def.minParam] ?? Settings.get(def.minKey) ?? '';
		maxEl.value = obj.urlParams[def.maxParam] ?? Settings.get(def.maxKey) ?? '';

		const eventType = def.selectRange ? 'change' : 'input';
		observeChange(minEl, def.minKey, true, 'value', eventType);
		observeChange(maxEl, def.maxKey, true, 'value', eventType);

		obj.filters.push({ element: minEl, property: 'value', parameter: def.minParam });
		obj.filters.push({ element: maxEl, property: 'value', parameter: def.maxParam });
	}

	ags_renderCheckbox(parent, obj, def) {
		const element = createElements(parent, 'beforeend', [
			{
				type: 'div',
				attributes: { class: 'esgst-ags-checkbox-filter' },
				children: [{ text: def.label, type: 'span' }]
			}
		]);

		const checkedFromUrl = obj.urlParams[def.parameter];
		const checkbox = new Checkbox(
			element,
			checkedFromUrl !== undefined ? checkedFromUrl === 'true' || checkedFromUrl === '1' : Settings.get(def.key)
		).input;

		observeChange(checkbox, def.key, true, 'checked', 'change');

		obj.filters.push({ element: checkbox, property: 'checked', parameter: def.parameter });
	}

	ags_renderTextInput(parent, obj, def) {
		let label = def.label;
		if (def.parameter === 'app') label = 'App Id';
		if (def.parameter === 'sub') label = 'Sub Id';

		const element = createElements(parent, 'beforeend', [
			{
				type: 'div',
				children: [
					{ text: `${label} `, type: 'node' },
					{
						type: 'div',
						attributes: { class: 'esgst-ags-filter' },
						children: [
							{
								type: 'input',
								attributes:
									def.parameter === 'app' || def.parameter === 'sub'
										? { type: 'number', min: 0, placeholder: def.placeholder }
										: { type: 'text', placeholder: def.placeholder }
							}
						]
					}
				]
			}
		]);

		const input = element.querySelector('input');
		input.value = obj.urlParams[def.parameter] ?? Settings.get(def.key) ?? '';

		if (def.parameter === 'app' || def.parameter === 'sub') {
			input.addEventListener('input', () => {
				input.value = input.value.replace(/\D/g, '');
			});
		}

		observeChange(input, def.key, true, 'value', 'input');

		obj.filters.push({ element: input, property: 'value', parameter: def.parameter });
	}

	ags_searchQuery(obj) {
		let url = `https://www.steamgifts.com/giveaways/search?q=${encodeURIComponent(obj.input.value)}`;

		for (const filter of obj.filters) {
			let value = filter.element[filter.property];
			if (value === null || value === undefined || value === '') continue;

			if (filter.parameter === 'region_restricted' || filter.parameter === 'dlc') {
				if (!value) continue;
				value = 'true';
			}

			url += `&${filter.parameter}=${encodeURIComponent(value)}`;
		}

		window.location.href = url;
	}
}

const giveawaysAdvancedGiveawaySearch = new GiveawaysAdvancedGiveawaySearch();

export { giveawaysAdvancedGiveawaySearch };
