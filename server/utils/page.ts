// server/utils/page.ts — SSR page rendering (Workers-safe: no fs reads,
// no runtime codegen — Eta's `new Function` compile is banned on Workers,
// so templates render through a minimal `<%= %>`/`<%~ %>` interpolator).
import layoutTemplate from "../templates/layout.html" with { type: "text" };
import gameBodyTemplate from "../templates/game.html" with { type: "text" };
import editorBodyTemplate from "../templates/editor.html" with { type: "text" };
import signinBodyTemplate from "../templates/signin.html" with { type: "text" };
import signupBodyTemplate from "../templates/signup.html" with { type: "text" };
import mylevelsBodyTemplate from "../templates/mylevels.html" with { type: "text" };
import quickstartBodyTemplate from "../templates/quickstart.html" with { type: "text" };
import alllevelsBodyTemplate from "../templates/alllevels.html" with { type: "text" };
import userlevelsBodyTemplate from "../templates/userlevels.html" with { type: "text" };
import reportBodyTemplate from "../templates/report.html" with { type: "text" };
import sidenavTemplate from "../templates/sidenav.html" with { type: "text" };
import { escapeHtml, first, isAsciiUsername, type SessionUser } from "./session";
import type { PublicLevelRow } from "./levels";
import type { H3Event } from "nitro";
import { getRequestURL, setResponseHeader } from "nitro/h3";

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
  // Validated `next` return target for the member forms ("" when none).
  next?: string;
  // Request origin (scheme + host) for absolute embed URLs. Set by
  // toPageView when the event is passed; "" renders no embed image.
  origin?: string;
}

// Session -> template view. Null (guest) maps to {} so pages render the
// signed-out chrome; signed-in sessions get the name + sign-out bar.
// One helper replaces the per-route ternary (was cloned in 5 routes).
// Pass the event so the view also carries the request origin (used for
// absolute og:/twitter: image URLs — never hardcoded).
export function toPageView(session: SessionUser | null, event?: H3Event): PageView {
  const origin = event ? getRequestURL(event).origin : undefined;
  if (!session) return origin ? { origin } : {};
  return {
    username: session.username,
    languagebar: userLanguageBar(session.username),
    ...(origin ? { origin } : {}),
  };
}

// Absolute embed image for link unfurls (Discord/Twitter require absolute
// URLs). Derived from the request origin — no hardcoded domain.
function embedImage(view: PageView): string {
  return view.origin ? `${view.origin}/images/embed.png` : "";
}

// HTML page responder: sets the content-type and returns the body.
// Replaces the per-route setResponseHeader clone (was cloned in 8 routes).
export function html(event: H3Event, body: string): string {
  setResponseHeader(event, "content-type", "text/html; charset=utf-8");
  return body;
}

const GAME_SWF = "/games/swf/52/52.swf";
const PRELOADER_SWF = "/swf/preloader/as3/v2/preloader-guest.swf";
const PRELOADER_SIGNEDIN_SWF = "/swf/preloader/as3/v2/preloader-signedin.swf";
const DEFAULT_PLAYER_NAME = "Sonic The Hedgehog Level Player";
const REPORTER_HTML =
  `<a class="lozenge1" id="reporter" href="javascript:void(0)"><span>Report Level</span></a>`;

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
// Footer mid-link: members get My Levels, guests get Quickstart (the
// members-only levels page would just bounce them to sign-in).
function footerMidLink(signedIn: boolean): string {
  return signedIn
    ? `<a href="/editors/mylevels">My Levels</a>`
    : `<a href="/quickstart">Quickstart</a>`;
}
// Signed-out chrome is intentionally NOT used: all pages share the same
// header (game/editor chrome) for a consistent revival UI.

// Static domload snippet (page wiring, not an Eta template). The reporter
// guard keeps pages without the report block (ice-shuffle) working.
const gameDomloadExtra = `splitBorderBottom.render('playGame');reportArea = $('reportArea');reportButton = $('reporter');if(reportButton)reportButton.addEventListener('click', function(e) {
e.preventDefault();
e.stopPropagation();
expandReport();
});getTicker ('tickerAll', 10, 3, '', '', 'true');`;
const editorHeadExtra = `<style type="text/css" media="screen">
#pagecontent { float: left; width: 977px; margin-left: 5px; }
</style>
<link rel="preload" as="image" href="/editors/assets/spritesheet.png" />
`;
// Touch dpad + jump button over the level player (touch devices only;
// the overlay self-hides otherwise). Shared by the index and /play pages.
// ?v= cache-buster: these files change during the touch-controls rollout;
// the query guarantees browsers fetch the current revision (static hosts
// ignore the query when resolving the file).
const gameHeadExtra = `<link rel="stylesheet" href="/css/touch-controls.css" type="text/css" media="screen" />
`;
// Fullscreen letterbox stage for touch devices. Loaded on EVERY game page
// (index, /play, ice-shuffle): it only ever applies while fullscreened,
// which touch-fullscreen.js enters on a touch inside the SWF.
const fullscreenHeadExtra = `<link rel="stylesheet" href="/css/touch-fullscreen.css" type="text/css" media="screen" />
`;

// API connector id passed as the game's `id` flashvar (it loads
// /<id>.swf). A static filename, not a session — real sessions live
// server-side (see server/utils/session.ts).
const API_CONNECTOR_ID = "api-connector";
const DEFAULT_LEVEL_ID = 2914;
const DEFAULT_TITLE = "Green Hill Zone";
const TERRITORIES = ["EnglishUK", "EnglishUSA"];

// Minimal template renderer: `<%= it.x %>` HTML-escaped, `<%~ it.x %>` raw.
// Same placeholder syntax/semantics as before, zero codegen. Escaping is
// shared with server/utils/session.ts (single implementation).
function render(
  tpl: string,
  data: Record<string, unknown>,
): string {
  return tpl.replace(
    /<%([=~])\s*it\.([A-Za-z_$][\w$]*)\s*%>/g,
    (_, sig: string, key: string) => {
      const v = data[key];
      const s = v == null ? "" : String(v);
      return sig === "=" ? escapeHtml(s) : s;
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

function cleanUsername(v: unknown): string {
  // Signed-out `?user=` stub (the session name wins whenever signed in).
  // Passes printable ASCII through untouched so the look is never altered.
  const s = first(v);
  return typeof s === "string" && s.length >= 1 && s.length <= 32 && isAsciiUsername(s)
    ? s
    : "Guest";
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

// Sidebar with the per-session slot filled in: guests see the sign-up
// upsell, signed-in users get the Sonic side art (same left-side art as
// the sign-in page). Explicit dimensions reserve the slot before the
// image loads (220px column, 221x431 source) so login state never
// reflows the layout.
const SIDEBAR_SONIC =
  `<img class="sidebar-sonic" src="/images/sonic_side_sml.jpg" alt="Sonic" width="220" height="429" />`;

function sidebar(signedIn: boolean, sideActive = "sonic"): string {
  return render(sidenavTemplate, {
    // Signed-in members get My Levels here (they live in the editor);
    // guests get the Quick Start Guide instead.
    navButton: signedIn
      ? `<a href="/editors/mylevels" class="mylevels"></a>`
      : `<a href="/quickstart" class="quickstart"></a>`,
    upsell: signedIn ? SIDEBAR_SONIC : UPSELL_HTML,
    sonicOn: sideActive === "sonic" ? " on" : "",
    iceOn: sideActive === "ice" ? " on" : "",
  });
}

// Report block (two-pass fill: inner slots first, then the game template).
// Ice-shuffle drops the whole block (kills the bottom gap); its domload
// wiring below is null-safe so the shared snippet keeps working.
function reportBlockHtml(view: PageView, levelId: number | string): string {
  return render(reportBodyTemplate, {
    reportButton: REPORTER_HTML,
    editorButtons: editorButtons(!!view.username),
    levelId,
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

// Single source of truth for the <title> suffix: every page ends with
// "| Sonic ReLvl". Callers pass the base ("My Levels", level name, ...);
// the suffix is applied here so it can't drift between pages.
function pageTitle(base: string): string {
  return `${base} | Sonic ReLvl`;
}

// JSON bootstrap for client scripts; < escaped so it can't break out of <script>.
function bootstrap(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export interface GamePageOptions {
  contentSwf?: string;
  playerName?: string;
  // Base <title> (the "| Sonic ReLvl" suffix is applied automatically).
  title?: string;
  headExtra?: string;
  // Ice Shuffle variants: direct SWF embed, no report button, bare heading.
  playerSwf?: string;
  hideReport?: boolean;
  hideTitle?: boolean;
  hideEditorButtons?: boolean;
  // Ice Shuffle is a different game (own keys): no touch dpad/button.
  hideTouchControls?: boolean;
  sideActive?: string;
  // Movie embed size (defaults to the stock 640x448).
  gameWidth?: number;
  gameHeight?: number;
}

// Touch overlay for the level player (index + /play only): dpad (TL base
// + BL knob + BR half-ring feedback) and jump button (TR outline + knob).
// Self-shows only on touch-capable devices while fullscreened (see
// touch-controls.css + touch-fullscreen.js).
const TOUCH_CONTROLS_HTML = `            <div id="touch-controls">
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
            <script type="text/javascript" src="/js/touch-controls.js"></script>`;

export function renderGamePage(
  query: PageQuery,
  view: PageView = {},
  opts: GamePageOptions = {},
): string {
  const username = view.username ?? cleanUsername(query.user);
  const sessionId = cleanSession(query.session);
  const levelId = cleanLevelId(query.levelid);
  const playerName = opts.playerName ?? DEFAULT_PLAYER_NAME;
  const levelTitle = cleanTitle(query.title);
  const data = {
    username,
    sessionId,
    territory: cleanTerritory(query.territory),
    levelId,
    // JS literal for the flashvars: bare number for stock ids, quoted
    // string for custom (UUID) ids. The game SWF coerces to uint either way.
    levelIdJs: JSON.stringify(levelId),
    // Omitted entirely on player pages without zones (e.g. /play).
    zoneOneFrag: `,isZoneOne: ${cleanZoneOne(query.zoneone)}`,
    // Signed-in users get the signed-in preloader (modified copy); guests
    // keep the stock guest one. An explicit playerSwf always wins.
    playerSwf: opts.playerSwf ?? (view.username ? PRELOADER_SIGNEDIN_SWF : PRELOADER_SWF),
    reportBlock: opts.hideReport
      ? ""
      : reportBlockHtml(view, levelId),
    playerHeading: opts.hideTitle
      ? escapeHtml(playerName)
      : `${escapeHtml(playerName)} - ${escapeHtml(levelTitle)}`,
    contentSwf: opts.contentSwf ?? GAME_SWF,
    gameWidth: opts.gameWidth ?? 640,
    gameHeight: opts.gameHeight ?? 448,
    touchControls: opts.hideTouchControls ? "" : TOUCH_CONTROLS_HTML,
  };
  const body = sidebar(!!view.username, opts.sideActive) + render(gameBodyTemplate, data);
  return render(layoutTemplate, {
    // Player pages are titled by the level (same as /play), not by the
    // section: e.g. "Green Hill Zone | Sonic ReLvl".
    title: pageTitle(opts.title ?? levelTitle),
    embedImage: embedImage(view),
    languagebar: view.languagebar ?? NAV_LANGUAGEBAR,
    topnav: topnavFor(view),
    footerMidLink: footerMidLink(!!view.username),
    headExtra: (opts.headExtra ?? gameHeadExtra) + fullscreenHeadExtra,
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
    levelIdJs: JSON.stringify(levelId),
    contentSwf: GAME_SWF,
  });
  return render(layoutTemplate, {
    title: pageTitle(`${username} | Level Creators`),
    embedImage: embedImage(view),
    languagebar: view.languagebar ?? NAV_LANGUAGEBAR,
    topnav: topnavFor(view),
    footerMidLink: footerMidLink(!!view.username),
    headExtra: editorHeadExtra,
    domloadExtra: "",
    bootstrap: bootstrap({ sessionId, username, levelId }),
    body,
  });
}

const memberHeadExtra = `<link rel="stylesheet" href="/css/signin.css" type="text/css" media="screen" />
`;
const signinDomloadExtra = `;splitBorderBottom.render('round1');border2.render('pagecontent');`;

function renderMemberPage(
  bodyTpl: string,
  // Base <title> (the "| Sonic ReLvl" suffix is applied automatically).
  baseTitle: string,
  view: PageView = {},
): string {
  // Return target for the hidden form field + the cross-link to the other
  // member form (so switching sign-in <-> sign-up keeps it). Slots are
  // escaped on render; routes pass a validated value.
  const next = view.next ?? "";
  const withNext = (href: string) =>
    next ? `${href}?next=${encodeURIComponent(next)}` : href;
  const body = render(bodyTpl, {
    formError: view.formError ?? "",
    next,
    signupHref: withNext("/member/signup"),
    signinHref: withNext("/member/signin"),
  });
  return render(layoutTemplate, {
    title: pageTitle(baseTitle),
    embedImage: embedImage(view),
    languagebar: NAV_LANGUAGEBAR,
    topnav: topnavFor(view),
    footerMidLink: footerMidLink(!!view.username),
    headExtra: memberHeadExtra,
    domloadExtra: signinDomloadExtra,
    bootstrap: bootstrap({ username: "Guest" }),
    body,
  });
}

export function renderSigninPage(query: PageQuery, view: PageView = {}): string {
  return renderMemberPage(signinBodyTemplate, "Member Sign-in", view);
}

export interface LevelRow {
  id: string;
  name: string;
  cols: number;
  rows: number;
  published: boolean | null;
  updatedAt: unknown;
}

// YYYY-MM-DD for Date values, "" otherwise. Shared by both level-list
// renderers so the guard lives in one place.
function formatDate(v: unknown): string {
  return v instanceof Date && !isNaN(+v) ? v.toISOString().slice(0, 10) : "";
}

function renderLevelRows(levels: LevelRow[]): string {
  if (!levels.length) {
    return `<p style="padding: 12px 0">You have not created any levels yet. <a href="/editors/">Create your first level</a>.</p>`;
  }
  const items = levels.map((l, i) => {
    const name = escapeHtml(l.name);
    // Single-quoted JS string inside a double-quoted HTML attribute.
    const nameJs = l.name.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, "&quot;");
    const id = escapeHtml(l.id);
    const d = formatDate(l.updatedAt);
    const border = i === levels.length - 1 ? "none" : "1px solid #e0e0e0";
    return `<div style="padding: 6px 0; border-bottom: ${border}; overflow: hidden">
      <div style="float: left"><b><a href="/play/${id}" rel="nofollow">${name}</a></b> <span style="color: #666">${l.cols} x ${l.rows} tiles${d ? ` &middot; ${d}` : ""}</span>${l.published ? ` <span style="color: #1767c9; font-weight: bold">Published</span>` : ""}</div>
      <div style="float: right; cursor: pointer"><a class="lozenge2" href="/play/${id}" rel="nofollow"><span>Play</span></a>
      <a class="lozenge2" href="/editors/?load=${id}" rel="nofollow"><span>Open</span></a>
      <form action="/editors/mylevels/rename" method="post" style="display: inline" onsubmit="return promptRename('${nameJs}', this)"><input type="hidden" name="id" value="${id}" /><input type="hidden" name="name" value="" /><span class="button"><button type="submit" name="submit" value="rename">Rename</button></span></form>
      <form action="/editors/mylevels/delete" method="post" style="display: inline" onsubmit="return confirmDelete('${nameJs}')"><input type="hidden" name="id" value="${id}" /><span class="button"><button type="submit" name="submit" value="delete">Delete</button></span></form></div>
    </div>`;
  });
  return items.join("\n");
}

export function renderMyLevelsPage(
  view: PageView & { levels: LevelRow[] },
  pagination = "",
): string {
  return renderLevelListPage(view, "mylevels", "My Levels", mylevelsBodyTemplate, renderLevelRows(view.levels), "", pagination);
}

// PublicLevelRow (id, authorId, name, author, authorDisplay, dims,
// updatedAt) lives in server/utils/levels.ts — single source of truth.

function renderPublicLevelRows(levels: PublicLevelRow[], emptyHtml?: string, hideAuthor = false): string {
  if (!levels.length) {
    return emptyHtml ?? `<p style="padding: 12px 0">No published levels yet. <a href="/editors/">Create one</a>.</p>`;
  }
  const items = levels.map((l, i) => {
    const name = escapeHtml(l.name);
    // The per-user page (hideAuthor) skips the byline — every row is by
    // the page owner. All Levels links by user id (usernames may gain
    // spaces / punctuation / capitals later); the link text stays the
    // username.
    let byline = "";
    if (!hideAuthor) {
      const display = escapeHtml(l.authorDisplay ?? l.author ?? "Player");
      byline = l.author
        ? `by <a href="/editors/alllevels/${encodeURIComponent(l.authorId)}">${display}</a> &middot; `
        : `by ${display} &middot; `;
    }
    const id = escapeHtml(l.id);
    const d = formatDate(l.updatedAt);
    const border = i === levels.length - 1 ? "none" : "1px solid #e0e0e0";
    return `<div style="padding: 6px 0; border-bottom: ${border}; overflow: hidden">
      <div style="float: left"><b><a href="/play/${id}" rel="nofollow">${name}</a></b> <span style="color: #666">${byline}${l.cols} x ${l.rows} tiles${d ? ` &middot; ${d}` : ""}</span></div>
      <div style="float: right"><a class="lozenge2" href="/play/${id}" rel="nofollow"><span>Play</span></a></div>
    </div>`;
  });
  return items.join("\n");
}

// Pagination bar for the level-list pages: orange-gradient bar (gradient
// sampled from the orange lozenge button bg_button_span.gif, text
// #4c4c4c like the lozenge label), full-bleed flush to the box bottom,
// centered `page N/T` with popup-btn.gif chevrons (prev mirrored via CSS).
// Empty string when there is a single page (no bar rendered).
export function paginationBar(
  basePath: string,
  page: number,
  totalPages: number,
): string {
  if (totalPages <= 1) return "";
  const arrow = (dir: 1 | -1, enabled: boolean, target: number): string => {
    const img = `<img src="/images/popup-btn.gif" alt="" style="display:block;height:30px;width:auto;border:0${dir < 0 ? ";transform:scaleX(-1)" : ""}" />`;
    return enabled
      ? `<a href="${basePath}?page=${target}" rel="nofollow" style="display:block;height:30px;">${img}</a>`
      : `<span style="display:block;height:30px;opacity:0.35">${img}</span>`;
  };
  return `<div style="margin:10px -10px -10px;background:linear-gradient(to bottom,#fee6ba 0.00%,#fee3b5 4.76%,#fee0af 9.52%,#fedda8 14.29%,#fed9a1 19.05%,#fed599 23.81%,#fed091 28.57%,#fecc88 33.33%,#fec77f 38.10%,#ffc376 42.86%,#ffbf6f 47.62%,#ffbb68 52.38%,#ffb761 57.14%,#ffb35a 61.90%,#ffb053 66.67%,#ffad4d 71.43%,#ffa947 76.19%,#ffa641 80.95%,#ffa43c 85.71%,#ffa137 90.48%,#ffa035 95.24%,#ffa035 100.00%);border-radius:0 0 8px 8px;overflow:hidden;height:30px;color:#4c4c4c;font-weight:bold;font-size:12px;display:flex;align-items:center;justify-content:center;">${arrow(-1, page > 1, page - 1)}<span>&nbsp;&nbsp;page ${page}/${totalPages}&nbsp;&nbsp;</span>${arrow(1, page < totalPages, page + 1)}</div>`;
}

// Shared shell for the level-list pages (My Levels / All Levels / Levels
// by X): same sidebar + layout + border wiring, only the active nav tab,
// base title, body template, pre-rendered rows, and (for the per-user page)
// the heading differ. Extra `heading`/`pagination` keys are ignored by
// templates without the slot (the interpolator only replaces known
// placeholders).
function renderLevelListPage(
  view: PageView,
  active: string,
  baseTitle: string,
  bodyTpl: string,
  rows: string,
  heading = "",
  pagination = "",
): string {
  const body = sidebar(!!view.username) + render(bodyTpl, { rows, heading, pagination });
  return render(layoutTemplate, {
    title: pageTitle(baseTitle),
    embedImage: embedImage(view),
    languagebar: view.languagebar ?? NAV_LANGUAGEBAR,
    topnav: topnavFor(view, active),
    footerMidLink: footerMidLink(!!view.username),
    headExtra: "",
    // Draws the rounded content-box border (same as the game/editor pages).
    domloadExtra: `splitBorderBottom.render('playGame');`,
    bootstrap: bootstrap({ username: view.username ?? "Guest" }),
    body,
  });
}

export function renderAllLevelsPage(
  view: PageView & { levels: PublicLevelRow[] },
  pagination = "",
): string {
  return renderLevelListPage(view, "alllevels", "All Levels", alllevelsBodyTemplate, renderPublicLevelRows(view.levels), "", pagination);
}

// Per-user directory ("Levels by X", linked from author names in All
// Levels): published levels only, All Levels tab stays active.
export function renderUserLevelsPage(
  view: PageView & { levels: PublicLevelRow[] },
  displayName: string,
  pagination = "",
): string {
  const heading = `Levels by ${displayName}`;
  return renderLevelListPage(
    view,
    "alllevels",
    heading,
    userlevelsBodyTemplate,
    renderPublicLevelRows(
      view.levels,
      `<p style="padding: 12px 0">${escapeHtml(displayName)} has not published any levels yet. <a href="/editors/">Create one</a>.</p>`,
      true,
    ),
    heading,
    pagination,
  );
}

export function renderPlayPage(
  levelName: string,
  levelId: number | string,
  view: PageView = {},
  published: boolean | null = true,
): string {
  // Same player as the index page, but the isZoneOne flashvar is omitted:
  // custom levels carry their own dimensions. Owners previewing an
  // unpublished level get a right-aligned [Unpublished] marker in the
  // titlebar (floated first so it docks top-right of the heading bar).
  const unpublishedBadge = published
    ? ""
    : `<span style="float: right; padding-right: 12px">[Unpublished]</span>`;
  const gameBody = render(gameBodyTemplate, {
    sessionId: API_CONNECTOR_ID,
    territory: TERRITORIES[0],
    levelId,
    levelIdJs: JSON.stringify(levelId),
    zoneOneFrag: "",
    playerSwf: view.username ? PRELOADER_SIGNEDIN_SWF : PRELOADER_SWF,
    reportBlock: reportBlockHtml(view, levelId),
    playerHeading: `${unpublishedBadge}${escapeHtml(DEFAULT_PLAYER_NAME)} - ${escapeHtml(levelName)}`,
    contentSwf: GAME_SWF,
    gameWidth: 640,
    gameHeight: 448,
    touchControls: TOUCH_CONTROLS_HTML,
  });
  // Same sidebar as the index page.
  const body = sidebar(!!view.username) + gameBody;
  return render(layoutTemplate, {
    title: pageTitle(levelName),
    embedImage: embedImage(view),
    languagebar: view.languagebar ?? NAV_LANGUAGEBAR,
    topnav: topnavFor(view),
    footerMidLink: footerMidLink(!!view.username),
    headExtra: gameHeadExtra + fullscreenHeadExtra,
    domloadExtra: gameDomloadExtra,
    bootstrap: bootstrap({ sessionId: API_CONNECTOR_ID, username: view.username ?? "Guest", levelId }),
    body,
  });
}

export function renderSignupPage(query: PageQuery, view: PageView = {}): string {
  return renderMemberPage(signupBodyTemplate, "Member Sign-up", view);
}

// Quick Start Guide: archive body in revival chrome. Border wiring mirrors
// the archive domload (border2 === archive border5: corner 8, border 1);
// the h3 tops are already rendered globally by the layout.
const quickstartDomloadExtra = `splitBorderBottom.render('round1');border2.render('qs_box1');border2.render('qs_box2');border2.render('qs_box3');`;

export function renderQuickstartPage(view: PageView = {}): string {
  const body = sidebar(!!view.username, "") + render(quickstartBodyTemplate, {});
  return render(layoutTemplate, {
    title: pageTitle("Quick Start Guide"),
    embedImage: embedImage(view),
    languagebar: view.languagebar ?? NAV_LANGUAGEBAR,
    topnav: topnavFor(view),
    footerMidLink: footerMidLink(!!view.username),
    headExtra: "",
    domloadExtra: quickstartDomloadExtra,
    bootstrap: bootstrap({ username: view.username ?? "Guest" }),
    body,
  });
}
