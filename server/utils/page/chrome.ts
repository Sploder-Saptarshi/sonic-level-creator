// server/utils/page/chrome.ts — layout chrome, nav, sidebar, page helpers
import layoutTemplate from "../../templates/layout.html" with { type: "text" };
import sidenavTemplate from "../../templates/sidenav.html" with { type: "text" };
import reportBodyTemplate from "../../templates/report.html" with { type: "text" };
import { escapeHtml, type SessionUser } from "../session";
import { timingBadge } from "../timing";
import type { H3Event } from "nitro";
import { getRequestURL, setResponseHeader } from "nitro/h3";
import { render, bootstrap, pageTitle } from "./render";
import {
  NAV_LANGUAGEBAR,
  REPORTER_HTML,
  SIDEBAR_SONIC,
  UPSELL_HTML,
} from "./constants";

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
  next?: string;
  turnstileSitekey?: string;
  origin?: string;
  isModerator?: boolean;
  event?: H3Event;
}

// Session -> template view. Null (guest) maps to {} so pages render the
// signed-out chrome; signed-in sessions get the name + sign-out bar.
// One helper replaces the per-route ternary (was cloned in 5 routes).
// Pass the event so the view also carries the request origin (used for
// absolute og:/twitter: image URLs — never hardcoded).
export function toPageView(session: SessionUser | null, event?: H3Event): PageView {
  const origin = event ? getRequestURL(event).origin : undefined;
  const base: PageView = {
    ...(origin ? { origin } : {}),
    ...(event ? { event } : {}),
  };
  if (!session) return base;
  return {
    ...base,
    username: session.username,
    languagebar: userLanguageBar(session.username),
    isModerator: session.isModerator,
  };
}

// Server-timing badge for the layout's <%~ it.srvTiming %> slot. Resolved
// at layout-render time — the last step of the request — so wall/cpu/
// queries/heap cover the whole render. "" without a request event (never
// in practice: every route builds its view via toPageView(session, event)).
export function timingFor(view: PageView): string {
  return view.event ? timingBadge(view.event) : "";
}

// Absolute embed image for link unfurls (Discord/Twitter require absolute
// URLs). Derived from the request origin — no hardcoded domain.
export function embedImage(view: PageView): string {
  return view.origin ? `${view.origin}/images/embed.png` : "";
}

// HTML page responder: sets the content-type and returns the body.
export function html(event: H3Event, body: string): string {
  setResponseHeader(event, "content-type", "text/html; charset=utf-8");
  setResponseHeader(event, "cache-control", "no-store");
  return body;
}

function topnavItem(
  cls: string,
  href: string,
  label: string,
  active: boolean,
  rel = "",
): string {
  return `  <li class="${cls}"><a href="${href}"${active ? ` class="on"` : ""}${rel ? ` rel="${rel}"` : ""}>${label}</a></li>`;
}

export function topnavFor(view: PageView, active = ""): string {
  const items = [
    topnavItem("one", "/editors/alllevels", "All Levels", active === "alllevels"),
    topnavItem("two", "/editors/mylevels", "My Levels", active === "mylevels"),
    topnavItem(
      "three",
      "/member/account",
      "My Account",
      active === "account",
      "nofollow",
    ),
  ].join("\n");
  return `<ul id="topnav_in"${view.username ? ` class="loggedin"` : ""}>\n${items}\n</ul>\n`;
}

export function footerMidLink(signedIn: boolean): string {
  return signedIn
    ? `<a href="/editors/mylevels">My Levels</a>`
    : `<a href="/quickstart">Quickstart</a>`;
}

// Sidebar with the per-session slot filled in: guests see the sign-up
// upsell, signed-in users get the Sonic side art (same left-side art as
// the sign-in page).
export function sidebar(signedIn: boolean, sideActive = "sonic"): string {
  return render(sidenavTemplate, {
    navButton: signedIn
      ? `<a href="/editors/mylevels" class="mylevels"></a>`
      : `<a href="/quickstart" class="quickstart"></a>`,
    upsell: signedIn ? SIDEBAR_SONIC : UPSELL_HTML,
    sonicOn: sideActive === "sonic" ? " on" : "",
    iceOn: sideActive === "ice" ? " on" : "",
  });
}

// Report block (two-pass fill: inner slots first, then the game template).
export function reportBlockHtml(view: PageView, levelId: number | string): string {
  return render(reportBodyTemplate, {
    reportButton: REPORTER_HTML,
    editorButtons: editorButtons(!!view.username),
    levelId,
  });
}

function editorButton(label: string, href: string): string {
  return `<a class="lozenge2" href="javascript:void(0);"
                           onclick="javascript:notifyOfLeaving('${href}', false);">
                             <span>${label}</span>
                         </a>`;
}

export function editorButtons(signedIn: boolean): string {
  const buttons = [editorButton("Create Level", "/editors/")];
  if (signedIn) buttons.push(editorButton("My Levels", "/editors/mylevels"));
  buttons.push(editorButton("All Levels", "/editors/alllevels"));
  return buttons.join("\n                        ");
}

// Shared shell for the level-list pages (My Levels / All Levels / Levels
// by X): same sidebar + layout + border wiring, only the active nav tab,
// base title, body template, pre-rendered rows, and (for the per-user page)
// the heading differ.
export function renderLevelListPage(
  view: PageView,
  active: string,
  baseTitle: string,
  bodyTpl: string,
  rows: string,
  heading = "",
  pagination = "",
  extra: Record<string, unknown> = {},
  headExtra = "",
): string {
  const body = sidebar(!!view.username) + render(bodyTpl, { rows, heading, pagination, ...extra });
  return render(layoutTemplate, {
    title: pageTitle(baseTitle),
    embedImage: embedImage(view),
    languagebar: view.languagebar ?? NAV_LANGUAGEBAR,
    topnav: topnavFor(view, active),
    footerMidLink: footerMidLink(!!view.username),
    ruffle: "",
    headExtra,
    domloadExtra: `splitBorderBottom.render('playGame');`,
    bootstrap: bootstrap({ username: view.username ?? "Guest" }),
    body,
    srvTiming: timingFor(view),
  });
}
