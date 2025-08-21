import { Module } from '../../class/Module';
import { common } from '../Common';
import { Settings } from '../../class/Settings';
import { DOM } from '../../class/DOM';
import dateFns_parse from 'date-fns/parse';
import dateFns_isValid from 'date-fns/isValid';

const createElements = common.createElements.bind(common),
	getFeatureTooltip = common.getFeatureTooltip.bind(common),
	sortContent = common.sortContent.bind(common),
	dateRegex = /\b(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s*\d{0,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*,?\s*\d{0,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|\d{4}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*'\d{2})\b/i;
  
class GeneralTableSorter extends Module {
	constructor() {
		super();
		this.info = {
			description: () => (
				<ul>
					<li>
						Adds a button (<i className="fa fa-sort"></i> if the table is sorted by the default
						order, <i className="fa fa-sort-asc"></i> if it is sorted by ascending order and{' '}
						<i className="fa fa-sort-desc"></i> if it is sorted by descending order) to the heading
						of each table's column (in any page) that allows you to sort the table by the values of
						the column.
					</li>
				</ul>
			),
			id: 'ts',
			name: 'Table Sorter',
			sg: true,
			st: true,
			type: 'general',
			featureMap: {
				endless: this.ts_getTables.bind(this),
			},
		};
	}

	ts_getTables(context, main, source, endless) {
		const tables = context.querySelectorAll(
			`${
				endless ? `.esgst-es-page-${endless} .table, .esgst-es-page-${endless}.table` : '.table'
			}, ${endless ? `.esgst-es-page-${endless} table, .esgst-es-page-${endless}table` : 'table'}`
		);
		for (let i = 0, n = tables.length; i < n; ++i) {
			this.ts_setTable(tables[i]);
		}
		if (!endless && !Settings.get('us')) {
			this.ts_sortTables();
		}
	}

	ts_sortTables() {
		let i, tsTable;
		for (i = this.esgst.tsTables.length - 1; i > -1; --i) {
			tsTable = this.esgst.tsTables[i];
			if (tsTable.columnName) {
				sortContent(
					this.ts_getArray(tsTable.columnName, tsTable.columnIndex, tsTable.table),
					`${tsTable.key}_${tsTable.name}`
				);
			}
		}
	}

	ts_setTable(table) {
		let button, columnName, columns, heading, tsTable;
		heading = table.querySelector(`.table__heading, .header, thead`);
		if (!heading) return;
		tsTable = {
			columnName: '',
			key: 'sortIndex',
			name: 'asc',
			outerWrap: table,
			table: table,
		};
		this.esgst.tsTables.push(tsTable);
		columns = heading.querySelectorAll(
			`.table__column--width-fill, .table__column--width-medium, .table__column--width-small, .column_flex, .column_medium, .column_small, th`
		);
		for (let i = 0, n = columns.length; i < n; ++i) {
			let column = columns[i];
			columnName = column.textContent.trim();
			if (
				!columnName.match(/^(Keys|Key|Not\sReceived|Remove)$/) &&
				(!this.esgst.wonPath || !columnName.match(/^Received$/)) &&
				!column.getElementsByClassName('esgst-ts-button')[0]
			) {
				button = createElements(column, 'beforeend', [
					{
						attributes: {
							class: 'esgst-ts-button esgst-clickable',
						},
						type: 'span',
					},
				]);
				this.ts_addDescButton(button, columnName, i, table, tsTable);
			}
		}
	}

	ts_addAscButton(button, columnName, i, table, tsTable) {
		createElements(button, 'atinner', [
			{
				attributes: {
					class: 'fa fa-sort-desc',
					title: `${getFeatureTooltip(
						'ts',
						'Currently sorted descending. Click to sort ascending.'
					)}`,
				},
				type: 'i',
			},
		]);
		button.firstElementChild.addEventListener(
			'click',
			this.ts_sortTable.bind(this, button, columnName, i, 'asc', table, tsTable)
		);
	}

	ts_addDescButton(button, columnName, i, table, tsTable) {
		createElements(button, 'atinner', [
			{
				attributes: {
					class: 'fa fa-sort',
					title: `${getFeatureTooltip(
						'ts',
						'Currently sorted by default. Click to sort descending.'
					)}`,
				},
				type: 'i',
			},
		]);
		button.firstElementChild.addEventListener(
			'click',
			this.ts_sortTable.bind(this, button, columnName, i, 'desc', table, tsTable)
		);
	}

	ts_addDefButton(button, columnName, i, table, tsTable) {
		createElements(button, 'atinner', [
			{
				attributes: {
					class: 'fa fa-sort-asc',
					title: `${getFeatureTooltip(
						'ts',
						'Currently sorted ascending. Click to sort by default.'
					)}`,
				},
				type: 'i',
			},
		]);
		button.firstElementChild.addEventListener(
			'click',
			this.ts_sortTable.bind(this, button, columnName, i, 'def', table, tsTable)
		);
	}

	ts_sortTable(button, columnName, i, key, table, tsTable) {
		tsTable.columnName = columnName;
		tsTable.columnIndex = i;
		tsTable.key = key === 'def' ? 'sortIndex' : 'value';
		tsTable.name = key;
		if (key === 'desc') {
			sortContent(this.ts_getArray(columnName, i, table), `value_${key}`);
			this.ts_addAscButton(button, columnName, i, table, tsTable);
		} else if (key === 'asc') {
			sortContent(this.ts_getArray(columnName, i, table), `value_${key}`);
			this.ts_addDefButton(button, columnName, i, table, tsTable);
		} else {
			sortContent(this.ts_getArray(columnName, i, table), 'sortIndex_asc');
			this.ts_addDescButton(button, columnName, i, table, tsTable);
		}
	}

	ts_handleDate(dateString) {
		if (typeof dateString !== 'string') return null;
		const cleanedDate = dateString.replace(/(\d+)(st|nd|rd|th)|,/gi, '$1').replace(/\s+/g, ' ').trim();
		const formats = [
			'MMM d yyyy', 'MMMM d yyyy',
			'd MMM yyyy', 'd MMMM yyyy',
			'yyyy MMM d', 'yyyy MMMM d',
			'yyyy-MM-dd',
			'MM/dd/yyyy', 'dd/MM/yyyy',
			'MMM d', 'd MMM', 'MMMM d', 'd MMMM',
			'MMMM yyyy', 'MMM yyyy'
		];
		for (const fmt of formats) {
			const parsed = dateFns_parse(cleanedDate, fmt, new Date());
			if (dateFns_isValid(parsed)) {
				if (!parsed.getFullYear()) parsed.setFullYear(new Date().getFullYear());
				return parsed;
			}
		}
		return null;
	}

	ts_getDateSubstring(value, regex, threshold = 0.7) {
		const match = value.match(regex);
		if (!match) return null;
		const matchedStr = match[0];
		const ratio = matchedStr.length / value.length;
		return ratio >= threshold ? matchedStr : null;
	}

	ts_parseMiscValue(value, element) {
		let numericMatch = value.match(/^[+-]?\d{1,3}(,\d{3})*(\.\d+)?(?!\w)/);
		if (numericMatch) {
			element.value = parseFloat(numericMatch[0].replace(/,/g, ''));
			if (isNaN(element.value)) element.value = 0;
			return true;
		}
		if (/^(from\s*)?[-+]?[A-Z]{0,3}[$€£¥₹]\d[\d,\.]*$/i.test(value)) {
			let cleaned = value.replace(/^from\s*/i, '').replace(/^[+]/, '').replace(/[A-Z]{0,3}[$€£¥₹]/i, '').replace(/,/g, '').trim();
			element.value = parseFloat(cleaned);
			if (isNaN(element.value)) element.value = 0;
			return true;
		}
		element.value = value.replace(/[^\x00-\x7F]/gu, '').trimStart() || value;
		return false;
	}

	ts_getArray(columnName, i, table) {
		let array, column, element, j, n, row, rows, value;
		array = [];
		rows = table.querySelectorAll(`.table__row-outer-wrap, .row_outer_wrap, tbody tr`);
		let isNumeric = false;
		const now = Date.now();
		for (j = 0, n = rows.length; j < n; ++j) {
			row = rows[j];
			column = row.querySelectorAll(
				`.table__column--width-fill, .table__column--width-medium, .table__column--width-small, .column_flex, .column_medium, .column_small, td`
			)[i];
			value = column && column.textContent.trim();
			element = {
				outerWrap: row,
				sortIndex: 0,
				value: undefined,
			};
			if (row.hasAttribute('data-sort-index')) {
				element.sortIndex = parseInt(row.getAttribute('data-sort-index'));
			} else {
				element.sortIndex = j;
				row.setAttribute('data-sort-index', j);
			}
			if ((value && value.length > 0) || columnName === 'Trending') {
				if (column.hasAttribute('data-sort-value')) {
					element.value = parseFloat(column.getAttribute('data-sort-value'));
				} else {
					switch (columnName) {
						case 'Trending':
							element.value =
								column.getElementsByClassName('fa-caret-up').length -
								column.getElementsByClassName('fa-caret-down').length;
							break;
						case 'Added':
						case 'Creation Date':
						case 'Date Entered':
						case 'First Giveaway':
						case 'Last Giveaway':
						case 'Last Online':
						case 'Last Post':
						case 'Last Update':
							try {
								element.value = value.match(/Online|Open/)
									? now
									: parseInt(
											column.querySelector(`[data-timestamp]`).getAttribute('data-timestamp')
									  ) * 1e3;
							} catch (e) {
								element.value = 0;
							}
							break;
						case 'Game':
						case 'Giveaway':
						case 'Group':
						case 'Status':
						case 'Summary':
						case 'Type':
						case 'User':
						case `Winner(s)`:
							element.value = value;
							break;
						default: {
							if (!value || value === '―' || value === '-') {
								element.value = '';
							} else {
								const dateSubstring = this.ts_getDateSubstring(value, dateRegex, 0.7);
								if (dateSubstring) {
									const parsedDate = this.ts_handleDate(dateSubstring);
									isNumeric = parsedDate ? (element.value = parsedDate.getTime(), true) : this.ts_parseMiscValue(value, element);
								} else {
									isNumeric = this.ts_parseMiscValue(value, element);
								}
							}
							break;
						}
					}
				}
			} else {
				element.value = 0;
			}
			array.push(element);
		}
		if (isNumeric) {
			for (let i = array.length - 1; i > -1; i--) {
				let element = array[i];
				if (typeof element.value === 'string') {
					element.value = 0;
				}
			}
		}
		return array;
	}
}

const generalTableSorter = new GeneralTableSorter();

export { generalTableSorter };
