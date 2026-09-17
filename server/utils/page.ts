// server/utils/page.ts — SSR page rendering (Workers-safe: no fs reads,
// no runtime codegen — Eta's `new Function` compile is banned on Workers,
// so templates render through a minimal `<%= %>`/`<%~ %>` interpolator).
import layoutTemplate from "../templates/layout.html" with { type: "text" };
import gameBodyTemplate from "../templates/game.html" with { type: "text" };
import editorBodyTemplate from "../templates/editor.html" with { type: "text" };
import signinBodyTemplate from "../templates/signin.html" with { type: "text" };
import signupBodyTemplate from "../templates/signup.html" with { type: "text" };
import { escapeHtml } from "./session";

// Logged-in header: same lozenges, signed-in name + sign-out (username is
// escaped here — the layout slot is raw).
export function userLanguageBar(username: string): string {
  const name = escapeHtml(username);
  return `<div id="languagebar" class="loggedin">  <span>Signed in as <b>${name}</b></span> <a class="lozenge1" href="javascript:void(0)" onclick="javascript:document.signoutForm.submit()" rel="nofollow"><span>Sign out</span></a>
  <form name="signoutForm" action="/member/signout" method="post" style="display:none"></form>
  </div>
`;
}

export interface PageView {
  username?: string;
  languagebar?: string;
  formError?: string;
}

// Shared-chrome variants (verbatim archive markup; layout holds the slots).
// Logged-in chrome (game + editor pages).
const NAV_LANGUAGEBAR = `<div id="languagebar">  <a class="lozenge1" href="/member/signup" rel="nofollow"><span>Quick Sign-up</span></a>
    <a class="lozenge1" href="/member/signin" rel="nofollow"><span>Sign-in</span></a>
</div>
`;
const NAV_LOGGED_IN_TOPNAV = `<ul id="topnav_in" class="loggedin">
  <li class="one"><a href="/games/" class="on">Play Games</a></li>
  <li class="two"><a href="/escape/">My Escape</a></li>
  <li class="three"><a href="/prizedraws/">Win Cash</a></li>
  <li class="four"><a href="/vip/">My VIP</a></li>
  <li class="five"><a href="/member/?action=editMyAccount" rel="nofollow">My Account</a></li>
  <li class="six"><a href="/downloads/">Download Games</a></li>
  <li class="seven"><a href="http://forums.sega.com/forumdisplay.php?f=115" target="_blank">Forum</a></li>
</ul>
`;
// Signed-out chrome is intentionally NOT used: all pages share the same
// header (game/editor chrome) for a consistent revival UI.

// Static domload snippet (page wiring, not an Eta template).
const gameDomloadExtra = `splitBorderBottom.render('playGame');reportArea = $('reportArea');reportButton = $('reporter');reportButton.addEventListener('click', function(e) {
e.preventDefault();
e.stopPropagation();
expandReport();
});getTicker ('tickerAll', 10, 3, '', '', 'true');`;
const editorHeadExtra = `<style type="text/css" media="screen">
#pagecontent { float: left; width: 977px; margin-left: 5px; }
</style>
<link rel="preload" as="image" href="/editors/assets/spritesheet.png" />
`;

// Offline session stub (mirrors ts/actions.ts TEST_API_ID). The game loads
// /<sessionId>.swf, so this must match public/<id>.swf until sessions are real.
const OFFLINE_SESSION_ID = "9f3210793951251c83ea5addaa24b963";
const DEFAULT_LEVEL_ID = 2914;
const DEFAULT_TITLE = "Sonic The Hedgehog Level Player - At Dawn";
const TERRITORIES = ["EnglishUK", "EnglishUSA"];

// Minimal template renderer: `<%= it.x %>` HTML-escaped, `<%~ it.x %>` raw.
// Same placeholder syntax/semantics as before, zero codegen.
const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function render(
  tpl: string,
  data: Record<string, unknown>,
): string {
  return tpl.replace(
    /<%([=~])\s*it\.([A-Za-z_$][\w$]*)\s*%>/g,
    (_, sig: string, key: string) => {
      const v = data[key];
      const s = v == null ? "" : String(v);
      return sig === "="
        ? s.replace(/[&<>"']/g, (c) => ESCAPES[c])
        : s;
    },
  );
}

export interface PageQuery {
  user?: unknown;
  session?: unknown;
  levelid?: unknown;
  territory?: unknown;
  title?: unknown;
  zoneone?: unknown;
}

function first(v: unknown): unknown {
  return Array.isArray(v) ? v[0] : v;
}

function cleanUsername(v: unknown): string {
  const s = first(v);
  return typeof s === "string" && /^[\w-]{1,32}$/.test(s) ? s : "Guest";
}

function cleanSession(v: unknown): string {
  const s = first(v);
  return typeof s === "string" && /^[0-9a-f]{32}$/i.test(s)
    ? s.toLowerCase()
    : OFFLINE_SESSION_ID;
}

function cleanLevelId(v: unknown): number {
  const n = Number(first(v));
  return Number.isInteger(n) && n > 0 && n < 1_000_000 ? n : DEFAULT_LEVEL_ID;
}

function cleanTerritory(v: unknown): string {
  const s = first(v);
  return typeof s === "string" && (TERRITORIES as string[]).includes(s)
    ? s
    : TERRITORIES[0];
}

function cleanTitle(v: unknown): string {
  const s = first(v);
  return typeof s === "string" && s.length > 0 && s.length <= 80
    ? s
    : DEFAULT_TITLE;
}

function cleanZoneOne(v: unknown): number {
  return Number(first(v)) === 0 ? 0 : 1;
}

// JSON bootstrap for client scripts; < escaped so it can't break out of <script>.
function bootstrap(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function renderGamePage(query: PageQuery, view: PageView = {}): string {
  const username = view.username ?? cleanUsername(query.user);
  const sessionId = cleanSession(query.session);
  const levelId = cleanLevelId(query.levelid);
  const data = {
    username,
    sessionId,
    territory: cleanTerritory(query.territory),
    levelId,
    levelTitle: cleanTitle(query.title),
    isZoneOne: cleanZoneOne(query.zoneone),
    contentSwf: "/games/swf/52/52.swf",
  };
  const body = render(gameBodyTemplate, data);
  return render(layoutTemplate, {
    title: `${username} | Level Creators | PlaySEGA`,
    languagebar: view.languagebar ?? NAV_LANGUAGEBAR,
    topnav: NAV_LOGGED_IN_TOPNAV,
    headExtra: "",
    domloadExtra: gameDomloadExtra,
    bootstrap: bootstrap({ sessionId, username, levelId }),
    body,
  });
}

export function renderEditorPage(query: PageQuery, view: PageView = {}): string {
  const username = view.username ?? cleanUsername(query.user);
  const sessionId = cleanSession(query.session);
  const levelId = cleanLevelId(query.levelid);
  const body = render(editorBodyTemplate, {
    username,
    sessionId,
    territory: cleanTerritory(query.territory),
    levelId,
  });
  return render(layoutTemplate, {
    title: `${username} | Level Creators | PlaySEGA`,
    languagebar: view.languagebar ?? NAV_LANGUAGEBAR,
    topnav: NAV_LOGGED_IN_TOPNAV,
    headExtra: editorHeadExtra,
    domloadExtra: "",
    bootstrap: bootstrap({ sessionId, username, levelId }),
    body,
  });
}

const memberHeadExtra = `<link rel="stylesheet" href="/css/signin.css" type="text/css" media="screen" />
`;
const signinDomloadExtra = `;splitBorderBottom.render('round1');border2.render('pagecontent');`;

export function renderSigninPage(query: PageQuery, view: PageView = {}): string {
  const body = render(signinBodyTemplate, {
    formError: view.formError ?? "",
  });
  return render(layoutTemplate, {
    title: "Member Sign-in | PlaySEGA",
    languagebar: NAV_LANGUAGEBAR,
    topnav: NAV_LOGGED_IN_TOPNAV,
    headExtra: memberHeadExtra,
    domloadExtra: signinDomloadExtra,
    bootstrap: bootstrap({ username: "Guest" }),
    body,
  });
}

export function renderSignupPage(query: PageQuery, view: PageView = {}): string {
  const body = render(signupBodyTemplate, {
    formError: view.formError ?? "",
  });
  return render(layoutTemplate, {
    title: "Member Sign-up | PlaySEGA",
    languagebar: NAV_LANGUAGEBAR,
    topnav: NAV_LOGGED_IN_TOPNAV,
    headExtra: memberHeadExtra,
    domloadExtra: signinDomloadExtra,
    bootstrap: bootstrap({ username: "Guest" }),
    body,
  });
}
