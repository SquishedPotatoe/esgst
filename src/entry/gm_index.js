import 'jQuery-QueryBuilder/dist/js/query-builder.standalone';
import '../browser-gm';
import '../main';

(async () => {
  if (!document.head) {
    await new Promise(resolve => {
      const check = () => {
        if (document.head) resolve();
        else requestAnimationFrame(check);
      };
      check();
    });
  }

  const awesomeBootstrapCheckboxCss = document.createElement('link');
  awesomeBootstrapCheckboxCss.rel = 'stylesheet';
  awesomeBootstrapCheckboxCss.href = await GM.getResourceUrl('awesome-bootstrap-checkbox');
  const jqueryQueryBuilderCss = document.createElement('link');
  jqueryQueryBuilderCss.rel = 'stylesheet';
  jqueryQueryBuilderCss.href = await GM.getResourceUrl('jquery-query-builder');
  document.head.appendChild(awesomeBootstrapCheckboxCss);
  document.head.appendChild(jqueryQueryBuilderCss);
})();
