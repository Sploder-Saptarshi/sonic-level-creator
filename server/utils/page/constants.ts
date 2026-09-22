// server/utils/page/constants.ts — shared string constants and HTML snippets (verbatim archive markup)

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

// Shared-chrome variants (verbatim archive markup; layout holds the slots).
export const NAV_LANGUAGEBAR = `<div id="languagebar">  <a class="lozenge1" href="/member/signup" rel="nofollow"><span>Quick Sign-up</span></a>
    <a class="lozenge1" href="/member/signin" rel="nofollow"><span>Sign-in</span></a>
</div>
`;

export const gameDomloadExtra = `splitBorderBottom.render('playGame');reportArea = $('reportArea');reportButton = $('reporter');if(reportButton)reportButton.addEventListener('click', function(e) {
e.preventDefault();
e.stopPropagation();
expandReport();
});getTicker ('tickerAll', 10, 3, '', '', 'true');`;

export const editorHeadExtra = `<style type="text/css" media="screen">
#pagecontent { float: left; width: 977px; margin-left: 5px; }
</style>
<link rel="preload" as="image" href="/editors/assets/spritesheet.png" />
`;

export const gameHeadExtra = `<link rel="stylesheet" href="/css/touch-controls.css" type="text/css" media="screen" />
`;

export const fullscreenHeadExtra = `<link rel="stylesheet" href="/css/touch-fullscreen.css" type="text/css" media="screen" />
`;

export const ruffleHeadExtra = `<script src="https://unpkg.com/@ruffle-rs/ruffle"></script>
`;

// Touch overlay for the level player (index + /play only): dpad (TL base
// + BL knob + BR half-ring feedback) and jump button (TR outline + knob).
export const TOUCH_CONTROLS_HTML = `            <div id="touch-controls">
                <div class="tc-dpad">
                    <div class="tc-base"></div>
                    <div class="tc-feedback"></div>
                    <div class="tc-knob"></div>
                </div>
                <div class="tc-btn">
                    <div class="tc-btn-ring"></div>
                    <div class="tc-btn-knob"></div>
                </div>
            </div>
            <script type="text/javascript" src="/js/touch-controls.js"></script>
            <script type="text/javascript" src="/js/gamepad-controls.js"></script>`;

// Guest upsell sidebar block (archive-verbatim). Guests see sign-up perks;
// signed-in users see nothing (empty string keeps the slot seamless).
export const UPSELL_HTML = `          <div id="upsellOne" class="upsellOne">
    <div class="upsell_guest">
        <div class="upsellOneContent">
            <div class="upsellOnePerks">
                <div class="upsellOnePerk">
                    <div class="upsellOnePerk_Levels">&nbsp;</div>
                    <div class="upsellOnePerk_Text">Build your own levels</div>
                </div>
                <div class="upsellOnePerk">
                    <div class="upsellOnePerk_Newgames">&nbsp;</div>
                    <div class="upsellOnePerk_Text">Share them with everyone</div>
                </div>
                <div class="upsellOnePerk">
                    <div class="upsellOnePerk_Joypad">&nbsp;</div>
                    <div class="upsellOnePerk_Text">Play community levels</div>
                </div>
                <div class="upsellOnePerk">
                    <div class="upsellOnePerk_Saveload">&nbsp;</div>
                    <div class="upsellOnePerk_Text">Save levels to your account</div>
                </div>
            </div>
            <div class="upsellButton">
                <a class="sifrButton1" href="/member/signup"><span class="text"><span class="fancybutton">Sign up now</span></span></a>
            </div>
        </div>
    </div>
</div>`;

export const SIDEBAR_SONIC =
  `<img class="sidebar-sonic" src="/images/sonic_side_sml.jpg" alt="Sonic" width="220" height="429" />`;

export const memberHeadExtra = `<link rel="stylesheet" href="/css/signin.css" type="text/css" media="screen" />
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async="async" defer="defer"></script>
`;

export const accountHeadExtra = `<style type="text/css" media="screen">
.acct-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0 0 8px; padding: 8px 12px; background: linear-gradient(#f4f4f4, #d9d9d9); border: 1px solid #c9c9c9; border-radius: 8px; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #333; text-align: left; }
.acct-user { font-size: 14px; }
.acct-actions { display: flex; align-items: center; gap: 8px; }
.acct-actions form { display: inline; margin: 0; }
.acct-panels { display: flex; gap: 8px; align-items: stretch; }
.acct-panel { flex: 1; min-width: 0; background: #fff; border: 1px solid #c9c9c9; border-radius: 8px; overflow: hidden; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000; text-align: left; }
.acct-title { margin: 0; padding: 8px 14px 6px; font-size: 14px; font-weight: bold; color: #333; background: linear-gradient(#f4f4f4, #d9d9d9); border-bottom: 1px solid #c9c9c9; }
.acct-body { padding: 12px 14px 14px; }
.acct-field { margin: 0 0 10px; }
.acct-body label { display: block; font-weight: bold; margin: 0 0 4px; }
.acct-body input[type=text], .acct-body input[type=password] { display: block; width: 100%; box-sizing: border-box; padding: 4px 8px; font-size: 12px; font-family: inherit; color: #333; background: #e9e9e9; border: 1px solid #c4c4c4; border-radius: 3px; outline: none; }
.acct-body input[type=text]:focus, .acct-body input[type=password]:focus { border-color: #1767c9; background: #fff; }
a.acct-btn, button.acct-btn { display: inline-block; height: 28px; padding: 0 18px; background: linear-gradient(to bottom, #ffedbe 0%, #ffc46a 45%, #ffa028 100%); border: 1px solid #e8932b; border-radius: 8px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.55); color: #333; font-weight: bold; font-size: 13px; font-family: inherit; text-decoration: none; cursor: pointer; }
a.acct-btn { line-height: 26px; }
a.acct-btn:hover, button.acct-btn:not(:disabled):hover { background: linear-gradient(to bottom, #fff6dd 0%, #ffd38c 45%, #ffb14e 100%); color: #333; text-decoration: none; outline: none; }
.acct-btn:disabled { opacity: 0.45; cursor: default; }
.acct-msg { margin: 0 0 8px; padding: 8px 12px; background: linear-gradient(#f4f4f4, #d9d9d9); border: 1px solid #c9c9c9; border-radius: 8px; font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: bold; text-align: left; }
.acct-msg-err { color: #eb7d02; }
.acct-msg-ok { color: #2f8f4e; }
</style>
`;

export const signinDomloadExtra = `;splitBorderBottom.render('round1');border2.render('pagecontent');`;

export const reportsHeadExtra = `<style type="text/css" media="screen">
.report-row { text-align: left; }
</style>
`;

export const reportsLinkHtml = `<a href="/editors/reports" rel="nofollow" style="float:right;color:#fff;font-size:12px;font-weight:bold;margin:-20px 8px 0 0;text-decoration:none">Review Reports <img src="/images/popup-btn-blue.gif" alt="" style="vertical-align:middle;border:0" /></a>`;

export const quickstartDomloadExtra = `splitBorderBottom.render('round1');border2.render('qs_box1');border2.render('qs_box2');border2.render('qs_box3');`;
