import NAV_LANGUAGEBAR from "../../templates/partials/languagebar-guest.html" with { type: "text" };
import TOUCH_CONTROLS_HTML from "../../templates/partials/touch-controls.html" with { type: "text" };
import UPSELL_HTML from "../../templates/partials/upsell.html" with { type: "text" };
import accountHeadExtra from "../../templates/partials/account-head.html" with { type: "text" };
import editorHeadExtra from "../../templates/partials/editor-head.html" with { type: "text" };
import memberHeadExtra from "../../templates/partials/member-head.html" with { type: "text" };
import reportsHeadExtra from "../../templates/partials/reports-head.html" with { type: "text" };

export {
  NAV_LANGUAGEBAR,
  TOUCH_CONTROLS_HTML,
  UPSELL_HTML,
  accountHeadExtra,
  editorHeadExtra,
  memberHeadExtra,
  reportsHeadExtra,
};

export const GAME_SWF = "/games/swf/52/52.swf";
export const PRELOADER_SWF = "/swf/preloader/as3/v2/preloader-signedin.swf";
export const PRELOADER_SIGNEDIN_SWF = "/swf/preloader/as3/v2/preloader-signedin.swf";
export const DEFAULT_PLAYER_NAME = "Sonic The Hedgehog Level Player";
export const REPORTER_HTML =
  `<a class="lozenge1" id="reporter" href="javascript:void(0)"><span>Report Level</span></a>`;

export const API_CONNECTOR_ID = "api-connector";
export const DEFAULT_LEVEL_ID = 2914;
export const DEFAULT_TITLE = "Green Hill Zone";
export const TERRITORIES = ["EnglishUK", "EnglishUSA"];

export const gameDomloadExtra = `splitBorderBottom.render('playGame');reportArea = $('reportArea');reportButton = $('reporter');if(reportButton)reportButton.addEventListener('click', function(e) {
e.preventDefault();
e.stopPropagation();
expandReport();
});getTicker ('tickerAll', 10, 3, '', '', 'true');`;

export const gameHeadExtra = `<link rel="stylesheet" href="/css/touch-controls.css" type="text/css" media="screen" />
`;

export const fullscreenHeadExtra = `<link rel="stylesheet" href="/css/touch-fullscreen.css" type="text/css" media="screen" />
`;

export const ruffleHeadExtra = `<script src="https://unpkg.com/@ruffle-rs/ruffle"></script>
`;

export const SIDEBAR_SONIC =
  `<img class="sidebar-sonic" src="/images/sonic_side_sml.jpg" alt="Sonic" width="220" height="429" />`;

export const signinDomloadExtra = `;splitBorderBottom.render('round1');border2.render('pagecontent');`;

export const reportsLinkHtml = `<a href="/editors/reports" rel="nofollow" style="float:right;color:#fff;font-size:12px;font-weight:bold;margin:-20px 8px 0 0;text-decoration:none">Review Reports <img src="/images/popup-btn-blue.gif" alt="" style="vertical-align:middle;border:0" /></a>`;

export const quickstartDomloadExtra = `splitBorderBottom.render('round1');border2.render('qs_box1');border2.render('qs_box2');border2.render('qs_box3');`;
