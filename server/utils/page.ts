// server/utils/page.ts — SSR page rendering (Workers-safe: no fs reads,
// no runtime codegen — Eta's `new Function` compile is banned on Workers,
// so templates render through a minimal `<%= %>`/`<%~ %>` interpolator).
import layoutTemplate from "../templates/layout.html" with { type: "text" };
import gameBodyTemplate from "../templates/game.html" with { type: "text" };
import editorBodyTemplate from "../templates/editor.html" with { type: "text" };
import signinBodyTemplate from "../templates/signin.html" with { type: "text" };
import signupBodyTemplate from "../templates/signup.html" with { type: "text" };
import mylevelsBodyTemplate from "../templates/mylevels.html" with { type: "text" };
import alllevelsBodyTemplate from "../templates/alllevels.html" with { type: "text" };
import sidenavTemplate from "../templates/sidenav.html" with { type: "text" };
import { escapeHtml } from "./session";

// Logged-in header: same lozenges, signed-in name + sign-out (username is
// escaped here — the layout slot is raw).
export function userLanguageBar(username: string): string {
  const name = escapeHtml(username);
  return `<div id="languagebar" style="width:auto;min-width:200px;white-space:nowrap">  <span style="vertical-align:middle">Signed in as <b>${name}</b></span> <a class="lozenge1" style="vertical-align:middle;float:none;display:inline-block;margin-left:8px" href="javascript:void(0)" onclick="javascript:document.signoutForm.submit()" rel="nofollow"><span>Sign out</span></a>
  <form name="signoutForm" action="/member/signout" method="post" style="display:none"></form>
  </div>
`;
}

export interface PageView {
  username?: string;
  languagebar?: string;
  formError?: string;
}

const GAME_SWF = "/games/swf/52/52.swf";

// Shared-chrome variants (verbatim archive markup; layout holds the slots).
// Logged-in chrome (game + editor pages).
const NAV_LANGUAGEBAR = `<div id="languagebar">  <a class="lozenge1" href="/member/signup" rel="nofollow"><span>Quick Sign-up</span></a>
    <a class="lozenge1" href="/member/signin" rel="nofollow"><span>Sign-in</span></a>
</div>
`;
function topnavItem(
  cls: string,
  href: string,
  label: string,
  active: boolean,
  rel = "",
): string {
  return `  <li class="${cls}"><a href="${href}"${active ? ` class="on"` : ""}${rel ? ` rel="${rel}"` : ""}>${label}</a></li>`;
}

function topnavFor(view: PageView, active = ""): string {
  const items = [
    topnavItem("one", "/editors/alllevels", "All Levels", active === "alllevels"),
    topnavItem("two", "/editors/mylevels", "My Levels", active === "mylevels"),
    topnavItem(
      "three",
      "/member/?action=editMyAccount",
      "My Account",
      false,
      "nofollow",
    ),
  ].join("\n");
  return `<ul id="topnav_in"${view.username ? ` class="loggedin"` : ""}>\n${items}\n</ul>\n`;
}
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

// API connector id passed as the game's `id` flashvar (it loads
// /<id>.swf). A static filename, not a session — real sessions live
// server-side (see server/utils/session.ts).
const API_CONNECTOR_ID = "api-connector";
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
  return typeof s === "string" && /^[\w.-]{1,64}$/.test(s)
    ? s
    : API_CONNECTOR_ID;
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

// Guest upsell sidebar block (archive-verbatim). Guests see sign-up perks;
// signed-in users see nothing (empty string keeps the slot seamless).
const UPSELL_HTML = `          <div id="upsellOne" class="upsellOne">
    <div class="upsell_guest">
        <div class="upsellOneContent">
            <div class="upsellOnePerks">
                <div class="upsellOnePerk">
                    <div class="upsellOnePerk_Scores">&nbsp;</div>
                    <div class="upsellOnePerk_Text">Save high scores</div>
                </div>
                <div class="upsellOnePerk">
                    <div class="upsellOnePerk_Rings2">&nbsp;</div>
                    <div class="upsellOnePerk_Text">Collect PlaySEGA rings</div>
                </div>
                <div class="upsellOnePerk">
                    <div class="upsellOnePerk_Prizes2">&nbsp;</div>
                    <div class="upsellOnePerk_Text">Win cash prizes</div>
                </div>
                <div class="upsellOnePerk">
                    <div class="upsellOnePerk_Trial">&nbsp;</div>
                    <div class="upsellOnePerk_Text">
                        FREE 5 day PlaySEGA<sup>VIP</sup> trial
                    </div>
                </div>
            </div>
            <div class="upsellButton">
                <a class="sifrButton1" href="/member/signup"><span class="text"><span class="fancybutton">Sign up now</span></span></a>
            </div>
        </div>
    </div>
</div>`;

// Sidebar with the per-session upsell filled in.
function sidebar(signedIn: boolean): string {
  return render(sidenavTemplate, {
    upsell: signedIn ? "" : UPSELL_HTML,
  });
}

// Editor buttons under the player. Create Level shows for everyone (guests
// funnel into sign-in); My Levels needs an account. Rendered server-side
// into the <%~ it.editorButtons %> slot.
function editorButton(label: string, href: string): string {
  return `<a class="lozenge2" href="javascript:void(0);"
                           onclick="javascript:notifyOfLeaving('${href}', false);">
                            <span>${label}</span>
                        </a>`;
}

function editorButtons(signedIn: boolean): string {
  const buttons = [editorButton("Create Level", "/editors/")];
  if (signedIn) buttons.push(editorButton("My Levels", "/editors/mylevels"));
  buttons.push(editorButton("All Levels", "/editors/alllevels"));
  // Newline + 24 spaces between buttons: byte-identical to the separator
  // between Report Level and the slot in game.html, so every gap matches.
  return buttons.join("\n                        ");
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
    contentSwf: GAME_SWF,
    editorButtons: editorButtons(!!view.username),
  };
  const body = sidebar(!!view.username) + render(gameBodyTemplate, data);
  return render(layoutTemplate, {
    title: `${username} | Level Creators | PlaySEGA`,
    languagebar: view.languagebar ?? NAV_LANGUAGEBAR,
    topnav: topnavFor(view),
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
    topnav: topnavFor(view),
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
    topnav: topnavFor(view),
    headExtra: memberHeadExtra,
    domloadExtra: signinDomloadExtra,
    bootstrap: bootstrap({ username: "Guest" }),
    body,
  });
}

export interface LevelRow {
  id: string;
  name: string;
  cols: number;
  rows: number;
  published: boolean | null;
  updatedAt: unknown;
}

function renderLevelRows(levels: LevelRow[]): string {
  if (!levels.length) {
    return `<p style="padding: 12px 0">You have not created any levels yet. <a href="/editors/">Create your first level</a>.</p>`;
  }
  const items = levels.map((l) => {
    const name = escapeHtml(l.name);
    const id = escapeHtml(l.id);
    const d = l.updatedAt instanceof Date && !isNaN(+l.updatedAt)
      ? l.updatedAt.toISOString().slice(0, 10)
      : "";
    return `<div style="padding: 6px 0; border-bottom: 1px solid #e0e0e0; overflow: hidden">
      <div style="float: left"><b>${name}</b> <span style="color: #666">${l.cols} x ${l.rows} tiles${d ? ` &middot; ${d}` : ""}</span>${l.published ? ` <span style="color: #1767c9; font-weight: bold">Published</span>` : ""}</div>
      <div style="float: right"><a class="lozenge2" href="/editors/?load=${id}" rel="nofollow"><span>Open</span></a>
      <form action="/editors/mylevels/delete" method="post" style="display: inline"><input type="hidden" name="id" value="${id}" /><span class="button"><button type="submit" name="submit" value="delete">Delete</button></span></form></div>
    </div>`;
  });
  return items.join("\n");
}

export function renderMyLevelsPage(
  view: PageView & { levels: LevelRow[] },
): string {
  const body = sidebar(!!view.username) + render(mylevelsBodyTemplate, {
    rows: renderLevelRows(view.levels),
  });
  return render(layoutTemplate, {
    title: "My Levels | PlaySEGA",
    languagebar: view.languagebar ?? NAV_LANGUAGEBAR,
    topnav: topnavFor(view, "mylevels"),
    headExtra: "",
    // Draws the rounded content-box border (same as the game/editor pages).
    domloadExtra: `splitBorderBottom.render('playGame');`,
    bootstrap: bootstrap({ username: view.username ?? "Guest" }),
    body,
  });
}

export interface PublicLevelRow {
  id: string;
  name: string;
  author: string;
  cols: number;
  rows: number;
  updatedAt: unknown;
}

function renderPublicLevelRows(levels: PublicLevelRow[]): string {
  if (!levels.length) {
    return `<p style="padding: 12px 0">No published levels yet. <a href="/editors/">Create one</a>.</p>`;
  }
  const items = levels.map((l) => {
    const name = escapeHtml(l.name);
    const author = escapeHtml(l.author);
    const id = escapeHtml(l.id);
    const d = l.updatedAt instanceof Date && !isNaN(+l.updatedAt)
      ? l.updatedAt.toISOString().slice(0, 10)
      : "";
    return `<div style="padding: 6px 0; border-bottom: 1px solid #e0e0e0; overflow: hidden">
      <div style="float: left"><b>${name}</b> <span style="color: #666">by ${author} &middot; ${l.cols} x ${l.rows} tiles${d ? ` &middot; ${d}` : ""}</span></div>
      <div style="float: right"><a class="lozenge2" href="/play/${id}" rel="nofollow"><span>Play</span></a></div>
    </div>`;
  });
  return items.join("\n");
}

export function renderAllLevelsPage(
  view: PageView & { levels: PublicLevelRow[] },
): string {
  const body = sidebar(!!view.username) + render(alllevelsBodyTemplate, {
    rows: renderPublicLevelRows(view.levels),
  });
  return render(layoutTemplate, {
    title: "All Levels | PlaySEGA",
    languagebar: view.languagebar ?? NAV_LANGUAGEBAR,
    topnav: topnavFor(view, "alllevels"),
    headExtra: "",
    // Draws the rounded content-box border (same as the game/editor pages).
    domloadExtra: `splitBorderBottom.render('playGame');`,
    bootstrap: bootstrap({ username: view.username ?? "Guest" }),
    body,
  });
}

export function renderPlayPage(
  levelName: string,
  levelId: number | string,
  view: PageView = {},
): string {
  // Same player as the index page, but the isZoneOne flashvar is omitted:
  // custom levels carry their own dimensions.
  const gameBody = render(gameBodyTemplate, {
    sessionId: API_CONNECTOR_ID,
    territory: TERRITORIES[0],
    levelId,
    levelTitle: levelName,
    isZoneOne: 1,
    contentSwf: GAME_SWF,
    // Custom ids are UUID strings: the template emits levelid unquoted
    // (stock numeric ids), so quote it and drop the isZoneOne flashvar.
  }).replace(`levelid: ${levelId}`, `levelid: "${levelId}"`)
    .replace(/,isZoneOne: \d+/, "");
  // Same sidebar as the index page.
  const body = sidebar(!!view.username) + gameBody;
  return render(layoutTemplate, {
    title: `${levelName} | PlaySEGA`,
    languagebar: view.languagebar ?? NAV_LANGUAGEBAR,
    topnav: topnavFor(view),
    headExtra: "",
    domloadExtra: gameDomloadExtra,
    bootstrap: bootstrap({ sessionId: API_CONNECTOR_ID, username: view.username ?? "Guest", levelId }),
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
    topnav: topnavFor(view),
    headExtra: memberHeadExtra,
    domloadExtra: signinDomloadExtra,
    bootstrap: bootstrap({ username: "Guest" }),
    body,
  });
}
