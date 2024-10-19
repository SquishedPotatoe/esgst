import 'jQuery-QueryBuilder/dist/js/query-builder.standalone.min';
import 'jquery-ui/ui/widgets/progressbar';
import 'jquery-ui/ui/widgets/slider';
import '../browser-gm';
import '../main';

(async () => {
	const awesomeBootstrapCheckboxCss = document.createElement('link');
	awesomeBootstrapCheckboxCss.rel = 'stylesheet';
	awesomeBootstrapCheckboxCss.href = await GM.getResourceUrl('awesome-bootstrap-checkbox');
	const jqueryQueryBuilderCss = document.createElement('link');
	jqueryQueryBuilderCss.rel = 'stylesheet';
	jqueryQueryBuilderCss.href = await GM.getResourceUrl('jquery-query-builder');
	document.head.appendChild(awesomeBootstrapCheckboxCss);
	document.head.appendChild(jqueryQueryBuilderCss);
})();
