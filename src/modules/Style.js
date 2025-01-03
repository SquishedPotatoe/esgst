import { Shared } from '../class/Shared';
import { Settings } from '../class/Settings';

function addStyle() {
	let backgroundColor, color, colors, i, n, style;
	style = `
	:root {
		--esgst-gwc-highlight-width: ${Settings.get('gwc_h_width')};
		--esgst-gwr-highlight-width: ${Settings.get('gwr_h_width')};
	}
`;
	colors = [
		{
			id: 'gc_h',
			key: 'hidden',
			mainKey: 'esgst-gc',
		},
		{
			id: 'gc_gi',
			key: 'giveawayInfo',
			mainKey: 'esgst-gc',
		},
		{
			id: 'gc_ocv_fcv',
			key: 'originalCV-fcv',
			mainKey: 'esgst-gc',
		},
		{
			id: 'gc_ocv_rcv',
			key: 'originalCV-rcv',
			mainKey: 'esgst-gc',
		},
		{
			id: 'gc_fcv',
			key: 'fullCV',
			mainKey: 'esgst-gc',
		},
		{
			id: 'gc_rcv',
			key: 'reducedCV',
			mainKey: 'esgst-gc',
		},
		{
			id: 'gc_ncv',
			key: 'noCV',
			mainKey: 'esgst-gc',
		},
		{
			id: 'gc_hltb',
			key: 'hltb',
			mainKey: 'esgst-gc',
		},
		{
			id: 'gc_w',
			key: 'wishlisted',
			mainKey: 'esgst-gc',
		},
		{
			id: 'gc_f',
			key: 'followed',
			mainKey: 'esgst-gc',
		},
		{
			id: 'gc_o',
			key: 'owned',
			mainKey: 'esgst-gc',
		},
		{
			id: 'gc_pw',
			key: 'won',
			mainKey: 'esgst-gc',
		},
		{
			id: 'gc_i',
			key: 'ignored',
			mainKey: 'esgst-gc',
		},
		{
			id: 'gc_lg',
			key: 'learning',
			mainKey: 'esgst-gc',
		},
		{
			id: 'gc_rm',
			key: 'removed',
			mainKey: 'esgst-gc',
		},
		{
			id: 'gc_ea',
			key: 'earlyAccess',
			mainKey: 'esgst-gc',
		},
		{
			id: 'gc_tc',
			key: 'tradingCards',
			mainKey: 'esgst-gc',
		},
		{
			id: 'gc_a',
			key: 'achievements',
			mainKey: 'esgst-gc',
		},
		{
			id: 'gc_bd',
			key: 'banned',
			mainKey: 'esgst-gc',
		},
		{
			id: 'gc_bvg',
			key: 'bartervg',
			mainKey: 'esgst-gc',
		},
		{
			id: 'gc_sp',
			key: 'singleplayer',
			mainKey: 'esgst-gc',
		},
		{
			id: 'gc_mp',
			key: 'multiplayer',
			mainKey: 'esgst-gc',
		},
		{
			id: 'gc_sc',
			key: 'steamCloud',
			mainKey: 'esgst-gc',
		},
		{
			id: 'gc_l',
			key: 'linux',
			mainKey: 'esgst-gc',
		},
		{
			id: 'gc_m',
			key: 'mac',
			mainKey: 'esgst-gc',
		},
		{
			id: 'gc_dlc',
			key: 'dlc',
			mainKey: 'esgst-gc',
		},
		{
			id: 'gc_p',
			key: 'package',
			mainKey: 'esgst-gc',
		},
		{
			id: 'gc_rd',
			key: 'releaseDate',
			mainKey: 'esgst-gc',
		},
		{
			id: 'gc_g',
			key: 'genres',
			mainKey: 'esgst-gc',
		},
	];
	for (i = 0, n = colors.length; i < n; ++i) {
		color = Settings.get(`${colors[i].id}_color`);
		backgroundColor = Settings.get(`${colors[i].id}_bgColor`);
		style += `
		${colors[i].key === 'genres' ? 'a' : ''}.${colors[i].mainKey}-${
			colors[i].key
		}:not(.giveaway__column):not(.featured__column) {
			background-color: ${backgroundColor};
			${color ? `color: ${color};` : ''}
		}
		.${colors[i].mainKey}-${colors[i].key}.giveaway__column, .${colors[i].mainKey}-${
			colors[i].key
		}.featured__column {
			color: ${backgroundColor};
		}
	`;
	}
	colors = [
		{
			id: 'wbh_w',
			key: 'whitelisted',
			mainKey: 'esgst-wbh-highlight',
		},
		{
			id: 'wbh_b',
			key: 'blacklisted',
			mainKey: 'esgst-wbh-highlight',
		},
	];
	for (i = 0, n = colors.length; i < n; ++i) {
		color = Settings.get(`${colors[i].id}_color`);
		backgroundColor = Settings.get(`${colors[i].id}_bgColor`);
		style += `
		.${colors[i].mainKey}-${colors[i].key} {
			background-color: ${backgroundColor} !important;
			${color ? `color: ${color} !important;` : ''}
		}
	`;
	}
	style += `
	.esgst-button.sidebar__error {
		margin-bottom: 0;
	}

	.form__saving-button--gray {
		background-image: linear-gradient(#dadde4 0%, #c8ccd7 50%, #b2b7c2 100%);
		border-color: #bcc1cc #9da4b2 #7e8797 #a5adbc;
		color: #5d636f;
		text-shadow: 1px 1px 1px rgba(233, 236, 245, 0.5);
	}

	.form__saving-button--gray:not(.is-disabled):hover {
    background-image: linear-gradient(#dcdfe6 0%, #caced9 50%, #b4b9c4 100%);
	}

	.btn-action.yellow {
		background-image: linear-gradient(#f6f6ec 0%, #e9e9ca 100%);
		border-color: #e0e0a8 #dbdba0 #d6d68b #dedea4;
		color: #a59d7c;
		text-shadow: 1px 1px 1px rgba(255, 255, 255, 0.7);
	}

	.btn_action.yellow:hover:not(.is_saving):not(.is_disabled):not(:active) {
		background-image: linear-gradient(#fcfcec 0%, #e9e9ca 100%);
	}

	.btn_action.yellow:active:not(.is_saving):not(.is_disabled) {
		background-image: linear-gradient(#e6e6c9 0%, #e2e2b8 100%)
		box-shadow: 2px 2px 5px #a59d7c inset;
		text-shadow: 1px 1px 1px rgba(255, 255, 255, 0.5);
	}

	.notification--info, .notification.blue {
		background-image: linear-gradient(#eafef7 0%, #d9edf7 100%);
		border-color: #bce8f1;
		color: #53928f;
	}

	.notification--danger, .notification.red {
		background-image: linear-gradient(#f2efef 0%, #f2dede 100%);
		border-color: #ebccd1;
		color: #a96664;
	}

	.notification--default, .notification.gray {
		background-image: linear-gradient(#f3f4f6 0%, #e2e3e5 100%);
		border-color: #d6d8db;
		color: #5a5f63;
	}

	.esgst-sm-feature-container {
		display: flex;
		flex-direction: column;
	}

	.esgst-sm-feature, .esgst-sm-feature-name {
		align-items: center;
		display: flex;
	}

	.form-control {
		font-size: 12px !important;
		height: 22px !important;
		padding: 2px !important;
	}

	.form-control.has-error {
		border-color: #a94442;
		box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.075);
	}

	.footer_inner_wrap {
		justify-content: space-between;
	}

	.footer_inner_wrap > ul > :not(last-child) {
		margin-right: 15px;
	}

	.nav__button img, .nav_btn img {
		vertical-align: middle;
	}

	.nav_btn img {
		margin-right: 10px;
	}

	.esgst-tds-sidebar-item {
		align-items: center;
		display: flex;
		justify-content: space-between;
	}

	.esgst-tds-sidebar-item .sidebar__navigation__item__link {
		flex: 1;
	}

	.ui-datepicker:not([style]) {
		display: none;
	}

	.esgst-tds-popout {
		max-height: 600px;
		max-width: 300px;
	}

	.esgst-tds-item {
		align-items: center;
		border: 1px solid #ccc;
		border-radius: 5px;
		display: flex;
		justify-content: space-between;
		margin-bottom: 2px;
		padding: 5px;
	}

	.esgst-tds-item-active {
		background-color: #eee;
	}

	.esgst-tds-item-name {
		font-size: 14px;
		font-weight: bold;
	}

	.esgst-tds-item-count {
		opacity: 0.75;
	}

	.esgst-tds-item-active .esgst-tds-item-count {
		font-weight: bold;
	}

	.esgst-tds-item-actions {
		display: flex;
	}

	.esgst-tds-item-actions >* {
		cursor: pointer;
		margin-right: 5px;
	}

	.esgst-cdr-highlight {
		color: #ff0000;
		font-weight: bold;
	}

	.esgst-logs-error i {
		color: #d9534f;
	}

	.esgst-log-error {
		background-color: #d9534f;
		color: #ffffff;
		text-shadow: none;
	}

	.esgst-logs-warning i {
		color: #f0ad4e;
	}

	.esgst-log-warning {
		background-color: #f0ad4e;
		color: #ffffff;
		text-shadow: none;
	}

	#esgst_permissions .esgst-ugd-table {
		min-width: unset;
	}

	.tour-backdrop {
		opacity: 0.5;
		z-index: 9999991100;
	}

	.tour-prevent {
		background: none;
		opacity: 0;
		z-index: 9999991102;
	}

	.popover[class*="tour-"] {
		color: #000;
		z-index: 9999991110;
	}

	.giveaway__links .esgst-button {
		background: none;
		border: none;
		font: inherit;
		margin: 0;
		padding: 0;
	}

	.giveaway__links .esgst-button:hover, .giveaway__links .esgst-button:active {
		background: none;
		border: none;
		box-shadow: none;
		text-shadow: none;
	}

	.esgst-restore-entry {
		display: flex;
		justify-content: space-between;
	}

	.esgst-restore-entry >* {
		margin: 0 5px 0;
	}

	.esgst-gv-popout .esgst-panel-flexbox {
		flex-direction: column;
	}

	.esgst-gv-popout .esgst-panel-flexbox .esgst-giveaway-panel {
		text-align: center;
	}

	.esgst-panel-flexbox {
		display: flex;
		justify-content: space-between;
	}

	.esgst-panel-flexbox .esgst-giveaway-panel {
		align-items: center;
		text-align: right;
	}

	.esgst-panel-flexbox .esgst-giveaway-links >* {
		white-space: nowrap;
	}

	.esgst-gesl >* {
		margin-right: 5px;
	}

	.esgst-scb input {
		min-width: 0;
	}

	.esgst-scb i.fa-times {
		cursor: pointer;
		margin-left: 5px;
	}

	.page__heading .esgst-button-container,  .page_heading .esgst-button-container, .esgst-page-heading .esgst-button-container {
		border: none;
		line-height: inherit;
		padding: 0;
		text-shadow: none;
	}

	.page__heading__button.esgst-button, .page_heading_btn.esgst-button {
		border: 1px solid #d2d6e0;
		border-radius: 4px;
		color: #4b72d4;
		cursor: pointer;
		display: block;
		font: 700 14px / 22px "Open Sans", sans-serif;
		padding: 5px 10px;
	}

	.page__heading__button.esgst-button i, .page_heading_btn.esgst-button i {
		margin: 0;
	}

	.esgst-element-ordering-box {
		border: 2px solid #ccc;
		border-radius: 5px;
		padding: 5px;
	}

	.esgst-element-ordering-box >* {
		border: 1px solid #ccc;
		border-radius: 5px;
		cursor: move;
		display: inline-block;
		margin: 5px;
		padding: 5px;
	}

	.esgst-page-heading-buttons {
		background: none;
		border: none;
		margin: 0 !important;
		padding: 0;
	}

		.esgst-page-heading-buttons >* {
		margin-right: 5px;
	}

	.esgst-inline-list >*:not(:last-child) {
		margin-right: 15px;
	}

	.form_list_item_summary_name {
		display: inline-block;
	}

	.esgst-tag-suggestions {
		background-color: #fff;
		border: 1px solid #ccc;
		border-radius: 5px;
		max-height: 200px;
		overflow: auto;
		position: absolute;
		width: 300px;
	}

	.esgst-tag-suggestion {
		cursor: pointer;
		font-weight: bold;
		padding: 5px;
		text-shadow: none;
	}

	.esgst-tag-suggestion:not(:last-child) {
		border-bottom: 1px solid #ccc;
	}

	.esgst-tag-suggestion.esgst-selected {
		background-color: #465670;
		color: #fff;
	}

	.table__row-inner-wrap .esgst-heading-button, .table__row-inner-wrap .esgst-ct-count, .table__row-inner-wrap .esgst-gdttt-button, .table__row-inner-wrap .esgst-tds-button, .row_trade_comments .esgst-heading-button, .row_trade_comments .esgst-ct-count, .row_trade_comments .esgst-gdttt-button, .row_trade_comments .esgst-tds-button {
		margin-left: 3px !important;
	}

	.esgst-gc-panel >*, .esgst-toggle-switch {
		margin-right: 3px !important;
	}

	.esgst-ugd-input {
		background-color: inherit !important;
		border-color: inherit !important;
		color: inherit;
		display: inline-block;
		margin: 0 5px;
		padding: 0 2px !important;
		width: 50px;
	}

	.esgst-hwlc-panel {
		display: flex;
		justify-items: space-between;
	}

	.esgst-hwlc-section {
		margin: 25px;
		width: 300px;
	}

	.esgst-hwlc-section textarea {
		min-height: 200px;
	}

	@keyframes border-blink {
		50% {
			border-color: transparent;
		}
	}

	.esgst-minimize-panel {
		left: -198px;
		position: fixed;
		top: 0;
		width: 200px;
		z-index: 999999999;
	}

	.esgst-minimize-panel:hover {
		padding-left: 198px;
	}

	.esgst-minimize-container {
		background-color: #fff;
		height: 100vh;
		overflow-y: auto;
		padding: 5px;
		width: 188px;
	}

	.esgst-minimize-panel.alert {
		animation: border-blink 1s ease-in-out infinite;
		border-right: 10px solid #ff0000;
		left: -200px;
	}

	.esgst-minimize-panel.alert:hover {
		border: none;
		left: -198px;
	}

	.esgst-minimize-item.alert {
		animation: border-blink 1s ease-in-out infinite;
		border: 2px solid #ff0000;
	}

	:root {
		--esgst-body-bg-color: ${Shared.esgst.sg ? '#f0f2f5' : '#ebedf0'};
	}

	.sticky_sentinel {
		left: 0;
		position: absolute;
		right: 0;
		visibility: hidden;
	}

	.esgst-gf-basic-filters {
		display: flex;
		justify-content: space-between;
	}

	.esgst-gf-basic-filters input {
		display: inline-block;
		padding: 2px;
		width: 100px;
	}

	.esgst-gf-basic-filters >* {
		margin: 5px;
	}

	.esgst-gf-number-filters {
		flex: 1;
	}

	.esgst-gf-number-filters >*, .esgst-gf-string-filters >* {
		align-items: center;
		display: flex;
		justify-content: space-between;
	}

	.esgst-gf-boolean-filters {
		column-count: 2;
		flex: 1;
	}

	.esgst-gf-basic-filters + div {
		font-size: 14px;
		font-weight: bold;
	}

	.esgst-gf-legend-panel {
		display: block;
		float: right;
		text-align: right;
		margin-top: 50px;
	}

	.esgst-ns, .esgst-ns * {
		max-width: 206px;
	}

	.esgst-clear-container {
		display: flex;
	}

	.esgst-clear-button {
		align-self: center;
		cursor: pointer;
		padding: 5px 10px;
	}

	.esgst-draggable-trash {
		background-color: #C11B17;
		border-radius: 5px;
		color: #E77471;
		position: absolute;
		text-align: center;
		text-shadow: none;
	}

	.esgst-draggable-trash i {
		font-size: 25px;
		margin: 5px;
	}

	.esgst-qiv-new {
		float: right;
		font-weight: bold;
		margin-right: 10px;
	}

	.esgst-mm-checkbox {
		display: inline-block;
		margin-right: 5px;
	}

	.esgst-mm-checkbox i {
		margin: 0;
	}

	.esgst-mm-popout {
		width: 550px;
	}

	.esgst-textarea-large {
		height: 400px !important;
		overflow-y: auto !important;
	}

	.esgst-mm-popout textarea, .esgst-textarea-small {
		height: 150px !important;
		overflow-y: auto !important;
	}

	.esgst-mm-button-group {
		align-items: center;
		display: flex;
	}

	.esgst-mm-button-group .esgst-button-container {
		display: inline-flex;
	}

	.esgst-mm-button-group .esgst-button {
		flex: 1;
		line-height: 25px;
		margin: 2px;
		padding-bottom: 0;
		padding-top: 0;
	}

	.esgst-mm-headings {
		display: flex;
		font-size: 0;
	}

	.esgst-mm-headings >* {
		background-color: #eee;
		border: 1px solid #ccc;
		cursor: pointer;
		flex: 1;
		font-size: 12px;
		font-weight: bold;
		padding: 5px;
		width: 150px;
	}

	.esgst-mm-headings .esgst-selected {
		background-color: #fff;
		border-bottom: 0;
	}

	.esgst-mm-sections {
		border-bottom: 1px solid #ccc;
		border-left: 1px solid #ccc;
		border-right: 1px solid #ccc;
		padding: 5px;
	}

	.esgst-mm-sections >* {
		display: none;
	}

	.esgst-mm-sections .esgst-selected {
		display: block;
	}

	.esgst-rotate-90 {
		transform: rotate(90deg);
	}

	.esgst-rotate-270 {
		transform: rotate(270deg);
	}

	.esgst-chfl-compact {
		padding: 8px 15px !important;
	}

	.footer__outer-wrap .esgst-chfl-panel, footer .esgst-chfl-panel {
		position: static !important;
	}

	.esgst-chfl-panel {
		position: absolute;
		right: 10px;
	}

	.esgst-chfl-panel i {
		background-color: #fff;
		border: 1px solid #ccc;
		border-radius: 5px;
		color: #555 !important;
		cursor: pointer;
		font-size: 18px !important;
		margin: 0 !important;
		padding: 5px;
		width: auto !important;
	}

	.esgst-chfl-small i {
		font-size: 18px !important;
		width: 36px;
	}

	.esgst-mgc-table * {
		text-align: left;
	}

	.esgst-ochgb {
		display: inline-block;
	}

	.featured__heading .esgst-ochgb i, .featured__heading .esgst-gf-hide-button i, .featured__heading .esgst-gf-unhide-button i, .featured__heading .esgst-gb-button i {
		opacity: .6;
		transition: opacity .2s;
	}

	.featured__heading .esgst-ochgb i:hover, .featured__heading .esgst-gf-hide-button i:hover, .featured__heading .esgst-gf-unhide-button i:hover, .featured__heading .esgst-gb-button i:hover {
		opacity: 1;
	}

	@keyframes esgst-blinker {
		50% { opacity: 0; }
	}

	.esgst-blinking {
		animation: esgst-blinker 1s linear infinite;
	}

	.esgst-qiv-popout {
		max-height: 600px !important;
		overflow: hidden !important;
		width: 600px;
	}

	.esgst-qiv-comments {
		overflow-y: auto;
	}

	.esgst-elgb-button .sidebar__error {
		margin-bottom: 0;
	}

	.esgst-mgc-preview {
		border: 1px solid #ccc;
		padding: 25px;
		width: 600px;
	}

	.esgst-mgc-input {
		display: inline-block;
		text-align: center;
		width: 75px;
	}

	.esgst-relative {
		position: relative;
	}

	.esgst-nm-icon {
		color: #ff0000 !important;
	}

	.esgst-disabled {
		cursor: default !important;
		opacity: 0.5;
	}

	.esgst-changelog img {
		max-width: 98%;
	}

	.esgst-radb-button {
		cursor: pointer;
		display: inline-block;
	}

	.esgst-radb-button.block_header {
		float: right;
		line-height: 33px;
		margin: 0 0 0 5px;
	}

	.esgst-radb-button.block_header > i {
		color: #bbb;
	}

	:not(.page__heading) > .esgst-radb-button:not(.block_header) {
		margin-left: 5px;
	}

	.esgst-cfh-preview {
		margin: 5px 0;
		text-align: left;
	}

	.esgst-qgs-container i {
		color: #AAB5C6;
	}

	.esgst-qgs-container {
		align-items: center;
		background-color: #fff;
		border-color: #c5cad7 #dee0e8 #dee0e8 #d2d4e0;
		border-radius: 4px;
		border-style: solid;
		border-width: 1px;
		display: flex;
		margin-right: 5px;
		padding: 5px 10px;
	}

	.esgst-qgs-container-expanded {
		position: ${Settings.get('qgs_index') === '0' ? 'absolute' : 'static'};
	}

	.esgst-qgs-container-expanded .esgst-qgs-input {
		width: 300px;
	}

	.esgst-qgs-container-expanded + .nav__button-container {
		margin-left: 40px;
	}

	.esgst-qgs-input {
		border: 0 !important;
		height: 100%;
		line-height: normal !important;
		padding: 0 !important;
		width: 0;
	}

	.esgst-sgc-results .table__row-outer-wrap {
		padding: 10px 5px;
	}

	.esgst-glwc-results {
		display: flex;
	}

	.esgst-glwc-results >* {
		flex: 1;
		margin: 10px;
	}

	.esgst-glwc-heading {
		font-family: "Open Sans";
		font-size: 25px;
		margin: 5px;
		text-align: center;
	}

	.esgst-stbb-button, .esgst-sttb-button {
		cursor: pointer;
	}

	.esgst-stbb-button-fixed, .esgst-sttb-button-fixed {
		bottom: ${Settings.get('ff') ? 49 : 5}px;
		background-color: #fff;
		border: 1px solid #d2d6e0;
		border-radius: 4px;
		color: #4B72D4;
		padding: 5px 15px;
		position: fixed;
		right: 5px;
	}

	.esgst-stbb-button:not(.esgst-hidden) + .esgst-sttb-button {
		bottom: 79px;
	}

	.esgst-bold {
		font-weight: bold;
	}

	.esgst-italic {
		font-style: italic;
	}

	.esgst-es-page-divider {
		margin: 5px 0;
	}

	.comment__parent .esgst-cerb-reply-button, .comment__child .esgst-cerb-reply-button {
		margin-top: 54px;
		position: absolute;
		text-align: center;
		width: 44px;
	}

	.comment_outer .esgst-cerb-reply-button, .comment_inner .esgst-cerb-reply-button {
		margin-left: 21px;
		margin-top: 34px;
		position: absolute;
		text-align: center;
		width: 24px;
	}

	.esgst-page-heading {
		display: flex;
		align-items: flex-start;
		word-wrap: break-word;
	}

	.esgst-page-heading >* {
		background-image: linear-gradient(#fff 0%, rgba(255,255,255,0.4) 100%);
		display: flex;
		padding: 5px 10px;
		border: 1px solid #d2d6e0;
		border-radius: 4px;
		color: #4B72D4;
		font: 700 14px/22px "Open Sans", sans-serif;
	}

	.esgst-page-heading i {
		line-height: 22px;
	}

	.esgst-page-heading >*:not(.page__heading__breadcrumbs) {
		align-items: center;
	}

	.esgst-page-heading >*:not(:last-child) {
		margin-right: 5px;
	}

	.esgst-form-row {
		margin-bottom: 20px;
	}

	.esgst-form-row:first-of-type {
		margin-top: 14px;
	}

	.esgst-form-heading {
		align-items: center;
		display: flex;
		margin-bottom: 5px;
	}

	.esgst-form-heading > div:not(:last-child) {
		margin-right: 10px;
	}

	.esgst-form-heading-number {
		font: 300 14px "Open Sans", sans-serif;
		color:#6b7a8c;
	}

	.esgst-form-heading-text {
		font: 700 14px "Open Sans", sans-serif;
		color: #4B72D4;
	}

	.esgst-form-row-indent {
		padding: 3px 0 3px 20px;
		margin-left: 5px;
		border-left: 1px solid #d2d6e0;
		box-shadow: 1px 0 0 rgba(255,255,255,0.3) inset;
	}

	.esgst-form-sync {
		display: flex;
	}

	.esgst-form-sync-data {
		flex: 1;
	}

	.esgst-notification {
		border: 1px solid;
		border-radius: 4px;
		padding: 0 15px;
		font-size: 11px;
		line-height: 32px;
		overflow: hidden;
	}

	.esgst-notification a {
		text-decoration: underline;
	}

	.esgst-notification-success {
		background-image: linear-gradient(#f7fcf2 0%, #e7f6da 100%);
		border-color: #C5E9A5;
		color:#8fa47b;
	}

	.esgst-notification-warning {
		background-image: linear-gradient(#F6F6E6 0px, #F5F5DF 20px);
		border-color: #EDE5B2;
		color: #a59d7c;
	}

	.esgst-user-icon {
		display: inline-block;
		line-height: normal;
		margin: 0 5px 0 0;
	}

	.esgst-user-icon i {
		border: 0;
		line-height: normal;
		margin: 0;
		text-shadow: none !important;
	}

	.esgst-whitelist {
		color: #556da9 !important;
	}

	.esgst-blacklist {
		color: #a95570 !important;
	}

	.esgst-positive {
		color: #96c468 !important;
	}

	.esgst-negative {
		color: #ec8583 !important;
	}

	.esgst-unknown {
		color: #77899a !important;
	}

	.esgst-ugd-table .table__rows .table__row-outer-wrap:hover {
		background-color: rgba(119, 137, 154, 0.1);
	}

	.esgst-ugd-table .table__column--width-small {
		min-width: 0;
		width: 12%;
	}

	.markdown {
		word-break: break-word;
	}

	.esgst-busy >* {
		opacity: 0.2;
	}

	.comment__actions .esgst-rml-link {
		margin: 0 0 0 10px;
	}

	.esgst-settings-menu .form__sync-default {
		margin: 0 5px;
	}

	.esgst-uh-popup a {
		border-bottom: 1px dotted;
	}

	.esgst-auto-sync {
		display: inline-block;
		margin: 0 5px 2px;
		padding: 0 2px;
		width: 50px;
	}

	.esgst-ap-popout .featured__table__row__left:not(.esgst-uh-title), .esgst-mr-reply, .esgst-mr-edit, .esgst-mr-delete, .esgst-mr-undelete {
		margin: 0 10px 0 0;
	}

	.esgst-ugd-button {
		cursor: pointer;
		display: inline-block;
	}

	.esgst-cfh-popout {
		font: 700 12px "Open Sans", sans-serif;
	}

	.esgst-cfh-panel span >:first-child >* {
		margin: 0 !important;
	}

	.esgst-cfh-popout input {
		width: auto;
	}

	.esgst-namwc-highlight {
		font-weight: bold;
	}

	.esgst-iwh-icon {
		margin: 0 0 0 5px;
	}

	.esgst-ap-suspended >* {
		color: #e9202a;
	}

	.esgst-ap-popout {
		border: none !important;
		border-radius: 5px;
		box-shadow: 0 0 10px 2px hsla(0, 0%, 0%, 0.8);
		min-width: 400px;
		padding: 0 !important;
		text-shadow: none;
	}

	.ui-tooltip {
		z-index: 99999;
	}

	.esgst-ap-popout .featured__outer-wrap:not(.esgst-uh-box) {
		border-radius: 5px;
		padding: 5px;
		width: auto;
		white-space: normal;
	}

	.esgst-ap-popout .featured__inner-wrap {
		align-items: flex-start;
		padding: 0 5px 0 0;
	}

	.esgst-ap-popout .featured__heading {
		margin: 0;
	}

	.esgst-ap-popout .featured__heading__medium {
		font-size: 18px;
	}

	.esgst-ap-link {
		width: 100px;
	}

	.esgst-ap-link .global__image-outer-wrap--avatar-large {
		box-sizing: content-box !important;
		height: 64px !important;
		margin: 5px;
		width: 64px !important;
	}

	.esgst-ap-popout .global__image-outer-wrap--avatar-large:hover {
		background-color: hsla(0, 0%, 25%, 0.2) !important;
	}

	.esgst-ap-link .global__image-inner-wrap {
		background-size: cover !important;
	}

	.esgst-ap-popout .sidebar__shortcut-outer-wrap {
		margin: 10px 0;
	}

	.esgst-ap-popout .sidebar__shortcut-inner-wrap i {
		height: 18px;
		font-size: 12px;
	}

	.esgst-ap-popout .sidebar__shortcut-inner-wrap * {
		line-height: 18px;
		vertical-align: middle;
	}

	.esgst-ap-popout .sidebar__shortcut-inner-wrap img {
		height: 16px;
		vertical-align: baseline !important;
		width: 16px;
	}

	.esgst-ap-popout .featured__table {
		display: inline-block;
		width: 100%;
	}

	.esgst-ap-popout .featured__table__row {
		padding: 2px;
	}

	.esgst-ap-popout .featured__table__row:nth-child(n + 3) {
		margin-left: -95px;
	}

	.esgst-ap-popout .featured__table__row:last-of-type .featured__table__row__right * {
		font-size: 11px;
	}

	.esgst-ct-comment-button {
		cursor: pointer;
	}

	.popup__keys__list .esgst-ggl-member, .esgst-dh-highlighted, .esgst-dh-highlighted.table__row-outer-wrap, .esgst-idb-highlight, .esgst-idb-highlight.table__row-outer-wrap {
		background-color: rgba(150, 196, 104, 0.2) !important;
		padding: 5px !important;
	}

	.esgst-error-button, .esgst-error-button >*:hover {
		background-color: rgba(236, 133, 131, 0.8) !important;
		background-image: none !important;
	}

	.esgst-gb-highlighted.ending i {
		color: rgba(236, 133, 131, 0.8) !important;
	}

	.esgst-gb-highlighted.started i {
		color: rgba(150, 196, 104, 0.8) !important;
	}

	.esgst-gb-highlighted.ending.started i {
		color: rgba(193, 165, 118, 0.8) !important;
	}

	.esgst-ct-visited {
		opacity: 0.5;
	}

	.esgst-ct-visited:hover {
		opacity: 1;
	}

	.esgst-ct-comment-read {
		opacity: 0.5;
	}

	.esgst-ct-comment-read:hover {
		opacity: 1;
	}

	.esgst-ct-comment-read:hover, .esgst-ct-visited:hover {
		background-color: rgba(119, 137, 154, 0.1) !important;
	}

	.esgst-gf-hide-button, .esgst-gf-unhide-button, .esgst-gb-button, .esgst-gdttt-button, .esgst-tds-button {
		cursor: pointer;
		display: inline-block;
		margin: 0 5px 0 0;
	}

	.esgst-codb-button, .esgst-dh-button, .esgst-idb-button, .esgst-df-button {
		display: inline-block;
		margin: 0 5px 0 0;
		padding: 0;
	}

	.page__heading .esgst-codb-button >*, .page__heading .esgst-dh-button >*, .page__heading .esgst-idb-button >*, .page__heading .esgst-df-button >* {
		padding: 5px 10px;
	}

	.esgst-pm-button {
		margin-left: -17px;
		position: absolute;
		top: calc(50% - 7px);
	}

	.esgst-dh-highlighted .esgst-pm-button, .esgst-idb-highlight .esgst-pm-button {
		margin-left: -22px;
	}

	.page__heading .esgst-pm-button {
		display: inline-block;
		margin: 0 5px 0 0;
		padding: 0;
		position: static;
	}

	.page__heading .esgst-pm-button >* {
		padding: 5px 10px;
	}

	.esgst-adots .esgst-pm-button {
		margin-left: -58px;
	}

	.comment__actions .esgst-ct-comment-button {
		margin: 0 0 0 10px;
	}

	.comment__actions >:first-child + .esgst-ct-comment-button {
		margin: 0;
	}

	.esgst-ct-comment-button >:not(:last-child) {
		margin: 0 10px 0 0;
	}

	.esgst-cfh-panel {
		margin: 0 0 2px;
		position: sticky;
		text-align: left;
	}

	.esgst-cfh-panel >* {
		background-color: #fff;
		border: 1px solid #ccc;
		border-radius: 5px;
		cursor: pointer;
		display: inline-block;
		margin: 1px;
		opacity: 0.5;
		padding: 5px;
	}

	.esgst-cfh-panel >*:hover {
		opacity: 1;
	}

	.esgst-cfh-panel span >:not(:first-child), .esgst-ded-status {
		display: block;
	}

	.esgst-cfh-panel span i {
		line-height: 22px;
	}

	.esgst-cfh-panel .form__saving-button {
		display: inline-block;
		margin: 5px;
		min-width:0;
	}

	.esgst-cfh-panel table {
		display: block;
		max-height: 200px;
		max-width: 375px;
		overflow: auto;
	}

	.esgst-cfh-panel table td:first-child {
		min-width: 25px;
		text-align: center;
	}

	.esgst-cfh-panel table td:not(:first-child) {
		min-width: 75px;
		text-align: center;
	}

	.esgst-cfh-emojis {
		display: block !important;
		font-size: 18px;
		max-height: 200px;
		min-height: 30px;
		overflow: auto;
		text-align: center;
	}

	.esgst-cfh-emojis >* {
		cursor: pointer;
		display: inline-block;
		margin: 2px;
	}

	.esgst-cfh-popout {
		white-space: normal;
		width: 300px;
	}

	.esgst-mpp-popup {
		position: fixed !important;
	}

	.esgst-mpp-visible {
		padding: 0;
	}

	.esgst-mpp-hidden {
		display: none;
		max-height: 75%;
		overflow: auto;
		padding: 15px;
		position: absolute;
		width: 75%;
	}

	.esgst-ueg {
		opacity: 1 !important;
	}

	.esgst-fh {
		height: auto !important;
		position: sticky;
		top: 0;
		z-index: 1000 !important;
	}

	.esgst-fs {
		overflow-y: auto;
		position: sticky;
	}

	.esgst-fs .sidebar__mpu {
		display: none !important;
	}

	.esgst-fmph {
		background-color: var(--esgst-body-bg-color);
		padding: 5px 0;
		position: sticky;
		z-index: 998;
	}

	.esgst-ff {
		background-color: inherit;
		bottom: 0;
		padding: 0;
		position: sticky;
		z-index: 999;
	}

	.esgst-ff.esgst-thin .footer_upper, .esgst-ff.esgst-thin .footer_columns {
		display: none;
	}

	.esgst-ff.esgst-thin .footer_lower, .esgst-ff.esgst-thin .footer_lower .footer_inner_wrap {
		border-top: none;
		box-shadow: none;
		padding: 12px 25px;
	}

	.esgst-ff.esgst-thin .footer_upper + .footer_lower .footer_inner_wrap {
		padding: 0px;
	}

	footer .footer_sites {
		gap: 15px;
	}

	.esgst-sgac-button, .esgst-sgg-button {
		margin: 0 5px 0 0;
	}

	.esgst-ct-count {
		color: #e9202a;
		font-weight: bold;
	}

	.esgst-uh-box {
		background: linear-gradient(to bottom, #555, #222);
		border: 1px solid #888;
		margin: 5px 0 0;
		padding: 15px;
		position: absolute;
		text-align: center;
	}

	.esgst-uh-title {
		color: rgba(255, 255, 255, 0.6);
		font-weight: bold;
		margin: 0 0 15px;
	}

	.esgst-uh-list {
		color: rgba(255, 255, 255, 0.4);
	}

	.esgst-ugd-button, .esgst-wbc-button, .esgst-namwc-button, .esgst-nrf-button {
		cursor: pointer;
		margin: 0 0 0 5px;
	}

	.esgst-luc-value {
		margin: 0 0 0 5px;
	}

	.esgst-sgpb-container {
		display: flex;
	}

	.esgst-sgpb-container >* {
		flex: 1;
	}

	.esgst-sgpb-button {
		background-image: linear-gradient(rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.3) 100%);
		border-color: #dde2ea #cdd4df #cbd1dc #d6dbe7;
		color: #6e7585;
		text-shadow: 1px 1px 1px #fff;
		transition: opacity 0.5s;
		border-radius: 3px;
		font: 700 13px 'Open Sans', sans-serif;
		margin: 0 0 0 5px;
		padding: 7px 15px;
		display: flex;
		align-items: center;
		border-width: 1px;
		border-style: solid;
		text-decoration: none;
	}

	.esgst-sgpb-button:active {
		background-image: linear-gradient(#e1e7eb 0%, #e6ebf0 50%, #ebeff2 100%) !important;
		box-shadow: 2px 2px 5px #ccd4db inset;
		text-shadow: 1px 1px 1px rgba(255, 255, 255, 0.6);
		margin: 2px 0 0 7px !important;
		border: 0;
	}

	.esgst-sgpb-button:hover {
		background-image: linear-gradient(rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0.3) 100%);
	}

	.esgst-sgpb-button i {
		height: 14px;
		margin: 0 10px 0;
		width: 14px;
	}

	.esgst-sgpb-button img {
		height: 14px;
		vertical-align: baseline;
		width: 14px;
	}

	.esgst-stpb-button img {
		vertical-align: top;
	}

	.esgst-gh-highlight, .esgst-green-highlight {
		background-color: rgba(150, 196, 104, 0.2);
	}

	.esgst-pgb-button, .esgst-gf-button {
		border: 1px solid #d2d6e0;
		border-top: none;
		background-color: #e1e6ef;
		background-image: linear-gradient(rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0) 100%);color: #6b7a8c;
		cursor: pointer;
		margin-bottom: 15px;
		padding: 3px;
		text-align: center;
		border-radius: 0 0 4px 4px;
	}

	.esgst-gf-button {
		margin-bottom: 0 !important;
	}

	.esgst-pgb-button:hover, .esgst-gf-button:hover {
		background-image:linear-gradient(rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0) 100%);
	}

	.esgst-gm-giveaway {
		background-color: #fff;
		border: 1px solid;
		border-radius: 4px;
		cursor: pointer;
		display: inline-block;
		margin: 5px 2px;
		padding: 2px 5px;
	}

	.esgst-feature-description {
		background-color: #fff;
		color: #465670;
		padding: 10px;
		width: 420px;
		border-radius: 4px;
	}

	.esgst-feature-description img {
		max-width: 400px;
	}

	.esgst-feature-description.esgst-popout > a {
	    line-height: 18px;
		margin: 2px;
	}

	.esgst-gm-giveaway.error {
		background-color: rgba(236, 133, 131, 0.5);
	}

	.esgst-gm-giveaway.success {
		background-color: rgba(150, 196, 104, 0.5);
	}

	.esgst-gm-giveaway.connected {
		text-decoration: line-through;
	}

	.esgst-gm-giveaway.selected {
		background-color: rgba(104, 150, 196, 0.5)
	}

	.esgst-gts-section >*, .esgst-gm-section >* {
		margin: 5px 0;
	}

	.esgst-gm-section .esgst-button {
		margin: 5px;
	}

	.esgst-button.sidebar__entry-delete, .esgst-button.sidebar__error {
		display: inline-block;
	}

	.sidebar .esgst-button {
		margin-bottom: 5px;
		display:block;
	}

	.sidebar__search-container {
		background-color: #fff;
		border-radius: 4px;
		border-width: 1px;
		border-style: solid;
		border-color: #c5cad7 #dee0e8 #dee0e8 #d2d4e0;
		line-height: 1.5em;
		padding: 5px 10px;
	}

	.esgst-button-group {
		display: block;
	}

	.esgst-button-group >* {
		display: inline-block;
	}

	.esgst-button-group >*:not(:first-child) {
		margin-left: 5px;
	}

	.esgst-ggl-panel {
		background: none;
		border: none;
		box-shadow: none !important;
		color: #6b7a8c;
		font-size: 12px;
		padding: 5px;
		white-space: unset;
	}

	.esgst-ggl-panel >* {
		display: inline-block;
	}

	.esgst-ggl-panel >*:not(:last-child) {
		margin-right: 10px;
	}

	.esgst-ggl-panel a:last-child {
		border-bottom: 1px dotted;
	}

	.esgst-ggl-panel .table_image_avatar {
		cursor: pointer;
		display: inline-block;
		height: 12px;
		width: 12px;
		vertical-align: middle;
	}

	.esgst-ggl-member {
		font-weight: bold;
	}

	.esgst-ggl-heading {
		font-weight: bold;
		line-weight: 22px;
		margin: 10px;
	}

	.esgst-gcl-popout, .esgst-ggl-popout {
		padding: 0 !important;
	}

	.esgst-gcl-popout .table__row-outer-wrap, .esgst-ggl-popout .table__row-outer-wrap {
		padding: 10px 5px;
	}

	.esgst-hidden-buttons {
		padding: 2px !important;
	}

	.esgst-popout {
		background-color: #fff;
		border: 1px solid #d2d6e0;
		border-radius: 4px;
		color: #465670;
		left: 0;
		overflow: auto;
		padding: 10px;
		position: absolute;
		top: 0;
		z-index: 999;
	}

	.esgst-aic-carousel {
		align-items: center;
		cursor: default !important;
		display: flex;
		justify-content: center;
	}

	.esgst-aic-carousel >:last-child {
		border: 5px solid #fff;
		border-radius: 5px;
		max-width: 90%;
	}

	.esgst-aic-carousel img {
		display: block;
	}

	.esgst-aic-panel {
		color: #fff;
		position: absolute;
		text-align: center;
		top: 25px;
	}

	.esgst-aic-left-button, .esgst-aic-right-button {
		cursor: pointer;
		display: inline-block;
		margin: 10px;
		text-align: center;
		width: 25px;
	}

	.esgst-aic-left-button i, .esgst-aic-right-button i {
		font-size: 25px;
	}

	.esgst-aic-source {
		font-weight: bold;
		margin-top: 10px;
		text-decoration: underline;
	}

	.esgst-popup-modal {
		background-color: rgba(60, 66, 77, 0.7);
		bottom: 0;
		cursor: pointer;
		left: 0;
		position: fixed;
		right: 0;
		top: 0;
	}

	.esgst-popup-large {
		width: 75%;
	}

	.esgst-popup-layer {
		align-items: ${Settings.get('static_popups') ? 'baseline' : 'center'};
		bottom: 0;
		display: flex;
		justify-content: ${Settings.get('static_popups') ? 'left' : 'center'};
		left: 0;
		padding: 50px;
		position: fixed;
		right: 0;
		top: 0;
	}

	.esgst-popup {
		background-color: var(--esgst-body-bg-color);
		border-radius: 4px;
		color: #465670;
		display: flex;
		flex-direction: column;
		padding: 25px;
		position: relative;
		text-align: center;
		text-shadow: 1px 1px rgba(255,255,255,0.94);
		transition: 500ms ease;
		z-index: 1;
	}

	.esgst-popout li:before, .esgst-popup li:before {
		margin-left: 0;
		padding-right: 10px;
		position: static;
		width: auto;
		text-align: left;
	}

	.esgst-popup-description .page__heading, .esgst-popup-description .page_heading {
		padding: 0;
	}

	.esgst-popup-description .page__heading, .esgst-popup-description .page_heading, .esgst-popup-description .esgst-notification-bar, .esgst-popup-description .esgst-gf-container {
		margin: 0 0 5px 0 !important;
	}

	.esgst-popup-description >*:not(.esgst-tag-suggestions):not(.page__heading):not(.page_heading):not(.esgst-notification-bar):not(.esgst-gf-container), .esgst-popup-scrollable >* {
		margin: 10px 0 0 !important;
	}

	.esgst-popup-description >*:not(.esgst-tag-suggestions):not(.page__heading):not(.page_heading):not(.esgst-notification-bar):not(.esgst-gf-container).esgst-button.form__submit-button, .esgst-popup-description >*:not(.esgst-tag-suggestions):not(.page__heading):not(.page_heading):not(.esgst-notification-bar):not(.esgst-gf-container).esgst-button.btn_action {
		margin-right: 8px !important;
	}

	.esgst-popup-actions {
		color: #4b72d4;
		margin-top: 15px;
	}

	.esgst-popup-actions a {
		border-bottom: 1px dotted;
		box-shadow: 0 1px 0 #fff;
		display: inline-block;
		cursor: pointer;
	}

	.esgst-popup-actions >*, .esgst-popup .esgst-button {
		display: inline-block;
	}

	.esgst-popup-actions >*:not(:last-child) {
		margin-right: 15px;
	}

	.esgst-popup-scrollable {
		overflow: auto;
	}

	.esgst-popup .popup__keys__list {
		max-height: none;
	}

	.esgst-heading-button {
		display: inline-block;
		cursor: pointer;
	}

	.esgst-popup-heading {
		display: flex;
		align-items: center;
		margin-bottom: 5px;
	}

	.esgst-popup-icon {
		font-size: 25px;
		margin-right: 10px;
	}

	.esgst-popup-title {
		font: 300 18px 'Open Sans', sans-serif;
	}

	.esgst-popup-title span {
		font-weight: bold;
	}

	.esgst-text-left {
		text-align: left;
	}

	.esgst-text-center {
		text-align: center;
	}

	.esgst-hidden {
		display: none !important;
	}

	.esgst-clickable {
		cursor: pointer;
	}

	.fa img {
		height: 14px;
		width: 14px;
		vertical-align: middle;
	}

	.nav__left-container .fa img {
		vertical-align: baseline;
	}

	.nav__left-container .nav__button-container--notification .nav__button {
		padding: 0 0 0 20px;
	}

	.esgst-checkbox, .esgst-hb-update, .esgst-hb-changelog {
		cursor: pointer;
	}

	.esgst-sm-small-number {
		font-size: 12px;
		display: inline-block;
	}

	.esgst-toggle-switch-container {
		align-items: center;
		display: flex;
		margin: 2px;
	}

	.esgst-toggle-switch-container.inline {
		display: inline-flex;
	}

	.esgst-toggle-switch-container i {
		margin: 0 5px;
	}

	.page__heading .esgst-toggle-switch-container.inline, .page_heading .esgst-toggle-switch-container.inline, .esgst-page-heading .esgst-toggle-switch-container.inline {
		height: 16px;
		margin: 0 2px;
		line-height: normal;
		vertical-align: middle;
	}

	.esgst-toggle-switch {
		position: relative;
		width: 26px;
		height: 14px;
	}

	.esgst-toggle-switch input {
		display: none !important;
	}

	.esgst-toggle-switch-slider {
		border-radius: 20px;
		position: absolute;
		cursor: pointer;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: #ccc;
		-webkit-transition: .4s;
		transition: .4s;
	}

	.esgst-toggle-switch-slider:before {
		border-radius: 50%;
		position: absolute;
		content: "";
		height: 12px;
		width: 12px;
		left: 1px;
		bottom: 1px;
		background-color: white;
		-webkit-transition: .4s;
		transition: .4s;
	}

	input:checked + .esgst-toggle-switch-slider {
		background-color: #4B72D4;
	}

	input:focus + .esgst-toggle-switch-slider {
		box-shadow: 0 0 1px #4B72D4;
	}

	input:checked + .esgst-toggle-switch-slider:before {
		-webkit-transform: translateX(12px);
		-ms-transform: translateX(12px);
		transform: translateX(12px);
	}

	.esgst-adots, .esgst-rbot {
		margin-bottom: 25px;
	}

	.esgst-float-left {
		float: left;
	}

	.esgst-float-right {
		float: right;
	}

	.esgst-clear {
		clear: both;
	}

	.esgst-rbot .reply_form .btn_cancel {
		display: none;
	}

	.esgst-aas-button {
		cursor: pointer;
		display: inline-block;
	}

	.esgst-es-page-heading {
		margin-top: 25px;
	}

	.esgst-gc-border {
		display: flex;
		height: 5px;
		margin-left: 5px;
		width: ${Settings.get('ib') ? '186px' : '174px'};
	}

	.esgst-gc-border >* {
		flex: 1;
	}

	.esgst-gc-panel {
		text-align: left;
	}

	.esgst-gc-panel a {
		text-decoration: none;
	}

	.esgst-gc-panel-inline {
		display: inline-block;
		margin: 0 0 0 5px;
	}

	.esgst-gch-highlight, .esgst-gc:not(.giveaway__column):not(.featured__column) {
		border-radius: 4px;
		display: inline-block;
		font-size: 10px;
		line-height: 10px;
		margin: 5px 0;
		padding: 2px 3px;
		text-shadow: none;
	}

	.esgst-gch-highlight {
		font-size: 14px;
		line-height: 14px;
		margin: 0 5px;
	}

	.esgst-glh-highlight {
		background-image: none !important;
		text-shadow: none;
	}

	a.esgst-gc-genres {
		max-width: 150px;
		overflow: hidden;
		text-overflow: ellipsis;
		vertical-align: middle;
		white-space: nowrap;
	}

	.esgst-popup .esgst-gf-container {
		top: 0;
	}

	.esgst-gf-container {
		text-align: left;
		z-index: 998;
	}

	.esgst-gf-container:not(.esgst-popup-scrollable) {
		background-color: #E8EAEF;
		border-radius: 4px;
	}

	.esgst-gf-Shared.esgst-popup-scrollable {
		min-width: 650px;
	}

	.esgst-gf-filters {
		display: flex;
		justify-content: space-between;
		overflow: auto;
		position: relative;
	}

	.esgst-gf-left-panel {
		flex: 1;
		max-height: 400px;
		overflow-y: auto;
	}

	.esgst-gf-right-panel .form__input-small {
		width: 100px !important;
	}

	.esgst-gf-filters >* {
		margin: 5px;
	}

	.esgst-gf-preset-panel {
		margin: 5px;
		text-align: right;
	}

	.esgst-gf-preset-panel >* {
		margin: 5px;
	}

	.esgst-gf-filter-count {
		background-color: #ddd;
		border-radius: 5px;
		font-size: 10px;
		padding: 2px;
		vertical-align: middle;
	}

	.esgst-gf-button {
		border-top: 1px;
	}

	.esgst-wbh-highlight {
		border: none !important;
		border-radius: 4px;
		padding: 2px 5px;
		text-shadow: none;
	}

	.page__heading__breadcrumbs .esgst-wbh-highlight {
		padding: 0 2px;
	}

	.esgst-sm-additional-option >*:not(.esgst-sm-additional-option) {
		align-items: center;
		display: flex;
		margin: 5px 0;
	}

	.esgst-sm-additional-option >* input, .esgst-sm-additional-option >* select, .esgst-sm-additional-option >* textarea {
		flex: 1;
	}

	.esgst-sm-additional-option >* >* {
		margin: 0 5px;
	}

	.esgst-ged-icon {
		margin: 0 0 0 10px;
	}

	.esgst-pgb-container {
		border-radius: 0 !important;
		margin: 0! important;
	}

	.esgst-gf-box {
		background-color: #E8EAEF;
		border: 1px solid #d2d6e0;
		border-radius: 0 !important;
		margin: 0! important;
		padding: 0 15px;
	}

	.esgst-gf-box.warning, .esgst-gf-button.warning {
		background-color: #FF0000;
		color: #FFFFFF;
		font-weight: bold;
		text-shadow: none;
	}

	.esgst-gf-box.warning .markdown li:before {
		color: #FFFFFF;
	}

	.esgst-gr-button {
		cursor: pointer;
		display: inline-block;
	}

	.esgst-egh-icon {
		cursor: pointer;
	}

	.giveaway__row-outer-wrap .esgst-egh-button, .giveaway__row-outer-wrap .esgst-gr-button, .table__row-outer-wrap .esgst-egh-button, .table__row-outer-wrap .esgst-egh-button, .table__row-outer-wrap .esgst-gr-button {
		margin-right: 5px;
	}

	p.table__column__heading {
		display: inline-block;
	}

	.esgst-giveaway-links {
		margin: 2px;
	}

	.esgst-gv-box .esgst-giveaway-panel:empty {
		height: 0;
		width: 0;
	}

	.esgst-giveaway-panel:empty {
		height: 25px;
		width: 250px;
	}

	.esgst-giveaway-panel.giveaway__columns {
		margin: 2px;
	}

	.giveaway__row-outer-wrap .esgst-button-container {
		border: 0;
		padding: 0;
	}

	.giveaway__row-outer-wrap .esgst-button {
		line-height: inherit;
		margin: 0;
	}

	.esgst-giveaway-panel >:first-child {
		margin: 0;
	}

	.esgst-giveaway-panel >*:not(:first-child) {
		margin: 0 0 0 5px;
	}

	.esgst-gv-popout .esgst-gwc, .esgst-gv-popout .esgst-gwr, .esgst-gv-popout .esgst-gptw, .esgst-gv-popout .esgst-ttec {
		display: inline-block;
		margin: 0 !important;
		padding: 0 5px !important;
		width: 67px !important;
		vertical-align: top;
	}

	.esgst-gv-popout .esgst-gp-button {
		display: inline-block;
		margin: 0 !important;
		width: auto !important;
		vertical-align: top;
	}

	.esgst-gv-popout .esgst-gp-button >* {
		padding: 0 5px !important;
		width: 67px !important;
	}

	.esgst-giveaway-panel .form__submit-button, .esgst-giveaway-panel .form__saving-button {
		margin-bottom: 0;
		min-width: 0;
	}

	.esgst-ged-source {
		font-weight: bold;
		margin: 5px 0;
	}

	.table__column--width-small {
		width: 8%;
	}

	.sidebar .table__row-outer-wrap {
		padding: 5px 0;
	}

	.esgst-adots-tab-heading {
		background-color: #2f3540;
		border-top-left-radius: 5px;
		border-top-right-radius: 5px;
		color: #fff;
		cursor: pointer;
		display: inline-block;
		opacity: 0.5;
		padding: 5px 10px;
		text-shadow: none;
	}

	.esgst-adots-tab-heading.esgst-selected {
		opacity: 1;
	}

	.sidebar .esgst-adots {
		margin-bottom: 15px;
		max-height: 300px;
		max-width: 336px;
		overflow: auto;
	}

	.sidebar .esgst-adots .esgst-dh-highlighted, .sidebar .esgst-adots .esgst-idb-highlighted {
		padding: 0 !important;
		padding-bottom: 5px !important;
	}

	.sidebar .esgst-adots .table__column__heading, .esgst-adots .homepage_table_column_heading {
		display: inline-block;
		max-width: 225px;
		overflow: hidden;
		text-overflow: ellipsis;
		vertical-align: middle;
		white-space: nowrap;
	}

	.esgst-ns .esgst-adots .table__column__heading, .esgst-ns .esgst-adots .homepage_table_column_heading {
		max-width: 100px;
	}

	.sidebar .esgst-adots .table__row-outer-wrap {
		padding: 3px 0 !important;
		border: 0;
		box-shadow: none;
	}

	.sidebar .esgst-adots .table__row-inner-wrap {
		display: block;
	}

	.sidebar .esgst-adots .table__row-inner-wrap >*:not(:last-child) {
		display: inline-block;
	}

	.table__column__secondary-link {
		border-bottom: 1px dotted;
		box-shadow: 0 1px 0 rgba(255, 255, 255, .3);
		color: #4b72d4;
	}

	.form__row:first-of-type {
		margin-top: 14px;
	}

	.form__row {
		margin-bottom: 20px;
	}

	.form__heading {
		align-items: center;
		display: flex;
		margin-bottom: 5px;
	}

	.form__heading>div:not(:last-child) {
		margin-right: 10px;
	}

	.form__heading__number, .form__heading__optional {
		font: 300 14px "Open Sans", sans-serif;
		color: #6b7a8c;
	}

	.form__heading__text {
		color: #4b72d4;
		font: 700 14px "Open Sans", sans-serif;
	}

	.form__row__indent {
		border-left: 1px solid #d2d6e0;
		box-shadow: 1px 0 0 rgba(255, 255, 255, .3) inset;
		margin-left: 5px;
		padding: 3px 0 3px 20px;
	}

	.icon_to_clipboard {
		color: #4b72d4;
		cursor: pointer;
		margin-right: 5px;
	}

	.esgst-gv-icons [data-draggable-id="elgb"]:not(.esgst-button-set):not(.esgst-button-container) {
		font-size: 12px;
		line-height: 16px;
		padding: 0 8px;
	}

	.esgst-gv-icons [data-draggable-id="elgb"]:not(.esgst-button-set):not(.esgst-button-container).form__saving-button.is-disabled {
		margin-bottom: -2px;
		max-width: 8.5ch;
		overflow: hidden;
		padding: 0 4px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.esgst-gv-icons [data-draggable-id="elgb"]:not(.esgst-button-set):not(.esgst-button-container) i {
		font-size: 12px;
		vertical-align: baseline;
	}

	.esgst-popup .esgst-idb-button {
		display: none;
	}

	.esgst-popup .esgst-df-button + .esgst-idb-button {
		display: inline-block !important;
	}

	.fanatical_container, .bundle_container {
		font-size: 12px;
		text-align: left;
	}

	.esgst-fmph .page_heading_btn_container {
		z-index: 1000;
	}

	.esgst-fmph .page_heading_btn_dropdown.is_selected + .dropdown .dropdown_btn {
		padding: 4px 15px;
	}

	.esgst-popup-description.esgst-text-left select, .esgst-popup-description.esgst-text-left input, .esgst-popup select, .esgst-auto-sync, .esgst-cfh-popout input, .esgst-switch-input {
		border-radius: 4px;
		border: 1px solid #d2d6e0;
		font: inherit;
		line-height: 1.5em;
	}

	header.large ~ .esgst-popup-layer .esgst-popup .esgst-button i, header.small ~ .esgst-popup-layer .esgst-popup .esgst-button i {
		margin-right: 3px;
		vertical-align: baseline;
	}

	.page_heading .esgst-button-container > .page_heading_btn.esgst-button i {
		line-height: 22px;
		margin: 0 !important;
	} 

	header ~ .esgst-popup-layer .esgst-popup .page_heading .esgst-button-container > .page_heading_btn.esgst-button i:nth-of-type(2), header ~ .esgst-popup-layer .esgst-popup .page_heading .esgst-button-container > .page_heading_btn.esgst-button i:nth-of-type(2) {
		margin-left: 3px !important;
	}

	.esgst-gv-box .esgst-gv-icons .esgst-button-container [data-draggable-id] {
		line-height: 16px;
		font-size: 12px;
		padding: 0 4px;
	}

	.esgst-sync-warning ~ .esgst-text-left hr {
		border-top: 1px solid #ccd6de; 
		border-bottom: 1px solid rgba(255, 255, 255, .3);
		margin: 0.5em 0;
	}

	.esgst-faded {
		opacity: 0.5;
	}

	.esgst-sm-faded >*:not(.SMFeatures) {
		opacity: 0.5;
	}

	.esgst-blue {
		color: #9dd9e1 !important;
	}

	.esgst-green {
		color: #96c468 !important;
	}

	.esgst-grey {
		color: #77899a !important;
	}

	.esgst-orange {
		color: #c1a576 !important;
	}

	.esgst-red {
		color: #ec8583 !important;
	}

	.esgst-yellow {
		color: #fecc66 !important;
	}

	.esgst-warning {
		color: #e9202a !important;
		font-weight: bold;
	}

	.esgst-sync-warning {
		font-size: 20px;
		font-weight: bold;
	}

	.esgst-toggle-switch-container .esgst-description, .esgst-button-group .esgst-description {
		display: inline-block;
		margin: 0;
	}

	.esgst-description {
		color: #6b7a8c;
		font-size: 11px;
		font-style: italic;
		margin-top: 10px;
	}

	.esgst-progress-bar {
		height: 10px;
		overflow: hidden;
		text-align: left;
	}

	.esgst-progress-bar .ui-progressbar-value {
		background-color: #96c468;
		height: 100%;
		margin: -1px;
	}

	.esgst-ib-user {
		background-color: #fff;
		background-position: 5px 5px;
		background-size: 32px;
		border: 1px solid #d2d6e0;
		border-radius: 4px;
		height: 44px;
		padding: 5px;
		width: 44px;
	}

	.featured__outer-wrap .esgst-ib-user {
		background-color: transparent;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.esgst-ib-game {
		background-color: #fff;
		background-position: 5px 5px;
		border: 1px solid #d2d6e0;
		border-radius: 4px;
		padding: 5px;
	}

	.giveaway__row-outer-wrap .esgst-ib-game {
		background-size: 184px 69px;
		height: 81px;
		width: 196px;
	}

	.table__row-outer-wrap .esgst-ib-game {
		background-size: 85px 32px;
		height: 44px;
		width: 97px;
	}

	.esgst-oadd >* {
		padding-left: 0 !important;
		margin-left: 0 !important;
		border-left: none !important;
		box-shadow: none !important;
	}

	.esgst-gv-spacing {
		font-weight: bold;
		padding: 10px;
		text-align: center;
		width: 100px;
	}

	.esgst-gv-view {
		font-size: 0;
		padding: 5px 0;
		text-align: center;
	}

	.esgst-gv-view.pinned-giveaways__inner-wrap--minimized .giveaway__row-outer-wrap:nth-child(-n + 10) {
		display: inline-block;
	}

	.esgst-gv-container {
		border: 0 !important;
		box-shadow: none !important;
		display: inline-block;
		font-size: 12px;
		padding: 0;
		text-align: center;
		vertical-align: top;
		width: ${Settings.get('ib') ? '196px' : '184px'};
	}

	.esgst-gv-box {
		display: block;
	}

	.esgst-gv-box >*:not(.giveaway__summary):not(.esgst-gv-icons) {
		margin: 0 !important;
	}

	.esgst-gv-box.is-faded:hover, .esgst-gv-box.esgst-faded:hover {
		opacity: 1;
	}

	.esgst-gv-icons {
		float: right;
		height: 18px;
		margin: -18px 0 0 !important;
	}

	.esgst-gv-icons .esgst-gc, .esgst-gv-icons .esgst-gwc, .esgst-gv-icons .esgst-gwr, .esgst-gv-icons .esgst-gptw, .esgst-gv-icons .esgst-ttec, .esgst-gv-time, .esgst-gv-icons .esgst-ged-source {
		background-color: #fff;
		padding: 2px !important;
	}

	.esgst-gv-icons .esgst-gp-button, .esgst-elgb-button > .form__saving-button {
		background-color: #fff;
	}

	.esgst-ged-source {
		font-weight: bold;
	}

	.esgst-gv-time i {
		font-size: 12px;
		vertical-align: baseline;
	}

	.esgst-gv-icons >* {
		line-height: normal;
		margin: 0 !important;
	}

	.esgst-gv-icons >*:not(.esgst-giveaway-column-button):not(.esgst-button-container) {
		padding: 1px 3px;
	}

	.esgst-gv-icons .giveaway__column--contributor-level {
		padding: 2px 5px !important;
	}

	.esgst-gv-popout {
		font-size: 11px;
		max-width: ${Settings.get('ib') ? '174px' : '162px'};
		overflow-x: hidden;
		overflow-y: auto;
		position: absolute;
		width: ${Settings.get('ib') ? '174px' : '162px'};
		z-index: 1;
	}

	.esgst-gv-popout .giveaway__heading {
		display: flex;
		flex-wrap: wrap;
		height: auto;
	}

	.esgst-gv-popout .giveaway__heading__name {
		display: inline-block;
		font-size: 12px;
		max-width: 150px;
		overflow: hidden;
		text-overflow: ellipsis;
		vertical-align: middle;
	}

	.esgst-gv-popout .giveaway__heading__thin {
		font-size: 11px;
	}

	.esgst-gv-popout .esgst-gc-panel {
		font-size: 11px;
		text-align: center;
	}

	.esgst-gv-popout .esgst-gc-panel i, .esgst-gv-popout .giveaway__links i, .esgst-gv-popout .esgst-gwc i, .esgst-gv-popout .esgst-gwr i, .esgst-gv-popout .esgst-gptw i, .esgst-gv-popout .esgst-ggl-panel, .esgst-gv-popout .esgst-ggl-panel i {
		font-size: 11px;
	}

	.esgst-gv-popout .giveaway__columns:not(.esgst-giveaway-panel):not(.esgst-gv-icons) {
		display: block;
		float: left;
		width: calc(100% - 37px);
	}

	.esgst-gv-popout .giveaway__columns:not(.esgst-giveaway-panel):not(.esgst-gv-icons) >* {
		margin: 0;
		text-align: left;
	}

	.esgst-gv-popout .esgst-giveaway-panel {
		display: block;
		font-size: 11px;
	}

	.esgst-gv-popout .esgst-giveaway-panel >* {
		margin: 0;
		overflow: hidden;
	}

	.esgst-gv-popout .esgst-button-container {
		width: 100%;
	}

	.esgst-gv-popout .esgst-button {
		padding: 0;
		width: 100%;
	}
	.esgst-gv-popout .giveaway__links a:last-child {
		margin: 0 !important;
	}

	.esgst-gv-popout .giveaway_image_avatar, .esgst-gv-popout .featured_giveaway_image_avatar {
		margin: 5px;
	}

	.esgst-gv-popout .esgst-giveaway-links, .esgst-gv-popout .esgst-giveaway-panel {
		float: none;
	}

	.esgst-gv-popout [data-draggable-id="winners"] {
		margin: 5px 0 0;
	}

	.esgst-ags-panel {
		margin: 0 0 15px 0;
		max-width: 316px;
		text-align: center;
	}

	.esgst-ags-panel >* {
		display: inline-block;
	}

	.esgst-ags-filter {
		display: block;
		margin: 5px;
	}

	.esgst-ags-filter >* {
		padding: 0 5px !important;
		width: 125px;
	}

	.esgst-ags-checkbox-filter {
		margin: 5px;
	}

	.esgst-ugs-difference, .esgst-switch-input {
		display: inline-block;
		padding: 0 !important;
		width: 50px;
	}

	.esgst-switch-input-large {
		width: 150px;
	}

	.esgst-gas-popout {
		background-color: #fff;
		border: 1px solid #d2d6e0;
		border-radius: 4px;
		color: #465670;
		padding: 10px;
	}

	.esgst-ds-popout {
		background-color: #fff;
		border: 1px solid #d2d6e0;
		border-radius: 4px;
		color: #465670;
		padding: 10px;
	}

	.esgst-cfh-sr-container {
		max-height: 234px;
		overflow-y: auto;
	}

	.esgst-cfh-sr-box {
		position: relative;
	}

	.esgst-cfh-sr-summary {
		border-radius: 5px;
		cursor: pointer;
		padding: 5px;
		width: 200px;
	}

	.esgst-cfh-sr-box:not(:first-child) {
		border-top: 1px solid #ccc;
	}

	.esgst-cfh-sr-box:last-child) {
		border-bottom: 1px solid #ccc;
	}

	.esgst-cfh-sr-summary:hover {
		background-color: #465670;
		color: #fff;
	}

	.esgst-cfh-sr-name {
		font-size: 14px;
		overflow: hidden;
		text-overflow: ellipsis;
		width: 200px;
		white-space: nowrap;
	}

	.esgst-cfh-sr-description {
		opacity: 0.75;
		overflow: hidden;
		text-overflow: ellipsis;
		width: 200px;
		white-space: nowrap;
	}

	.esgst-cfh-sr-controls {
		position: absolute;
		right: 5px;
		top: 10px;
	}

	.esgst-cfh-sr-controls >* {
		margin: 2px;
	}

	.giveaway__row-outer-wrap .esgst-tag-button, .table__row-outer-wrap .esgst-tag-button {
		margin-left: 5px;
	}

	.esgst-tag-list-button {
		padding: 8px;
		right: 25px;
		position: absolute;
	}

	.esgst-tag-list {
		font-weight: bold;
		text-align: left;
		text-shadow: none;
	}

	.esgst-tag-preview .esgst-tags {
		display: inline-block;
	}

	.esgst-tag-preview input[type=text] {
		display: inline-block;
		width: 100px;
		height: 15px;
	}

	.esgst-tag-preview input[type=color] {
		box-sizing: unset;
		height: 13px;
		line-height: normal;
		margin: 0;
		padding: 0;
		vertical-align: top;
		width: 15px;
	}

	.esgst-tag-button {
		border: 0! important;
		cursor: pointer;
		display: inline-block;
		line-height: normal;
		margin: 0 0 0 5px;
		text-decoration: none !important;
		transition: opacity 0.2s;
	}

	.esgst-tag-button:hover {
		opacity: 1;
	}

	.author_name + .esgst-tag-button {
		margin: 0 5px 0 0;
	}

	.esgst-tag-button i {
		margin: 0 !important;
	}

	.esgst-tags {
		font-size: 10px;
		font-weight: bold;
	}

	.esgst-tag {
		display: inline-block !important;
		height: auto;
		margin: 0;
		padding: 1px 2px;
		text-shadow: none;
		width: auto;
	}

	.esgst-tag:not(:first-child) {
		margin: 0 0 0 5px;
	}

	.esgst-gv-popout .esgst-tags, .esgst-adots .esgst-tags {
		display: none;
	}

	.esgst-settings-menu-feature {
		align-self: flex-start;
		margin-top: 14px;
		min-height: 400px;
		overflow: auto;
		position: sticky;
		top: 24px;
	}

	.esgst-menu-split {
		display: flex;
	}

	.esgst-menu-split >* {
		flex: 1;
		overflow: auto;
		word-wrap: break-word;
	}
`;
	if (!Shared.esgst.sg) {
		style += `
			.esgst-un-button, .page_heading .esgst-heading-button {
				background-image: linear-gradient(#fff 0%, rgba(255, 255, 255, 0.4) 100%);
				border: 1px solid #d2d6e0;
				border-radius: 3px;
				color: #4b72d4;
				cursor: pointer;
				display: inline-block;
				font: 700 14px/22px "Open Sans", sans-serif;
				padding: 5px 15px;
			}
		`;
	}
	Shared.esgst.style = Shared.common.createElements(document.head, 'beforeend', [
		{
			attributes: {
				id: 'esgst-style',
			},
			text: style,
			type: 'style',
		},
	]);
}

export { addStyle };
