// jQuery QueryBuilder want global interact object
import interact from 'interactjs';
import 'jQuery-QueryBuilder/dist/js/query-builder.standalone';
import 'bootstrap';
import 'jquery-ui/ui/widgets/progressbar';
import 'jquery-ui/ui/widgets/slider';
import VDF from 'simple-vdf';
import * as emojisUtils from 'emojis-utils';

import 'awesome-bootstrap-checkbox/awesome-bootstrap-checkbox.css';
import 'jQuery-QueryBuilder/dist/css/query-builder.default.css';

window.interact = interact;
window.VDF = VDF;
window.emojisUtils = emojisUtils;
